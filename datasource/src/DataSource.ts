import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
  RawTimeRange,
  TimeRange,
} from '@grafana/data';

import { SignalKQuery, SignalKDataSourceOptions } from './types';
import { Observable, Subscriber, lastValueFrom } from 'rxjs';
import ReconnectingWebsocket from './reconnecting-websocket';
import { DualDataFrame } from 'DualDataframe';
import { PathWithMeta } from 'QueryEditor';
import { getConverter } from 'conversions';
import { getBackendSrv } from '@grafana/runtime';

interface PathValue {
  path: string;
  value: number;
}

type PathValueHandler = (pv: PathValue, update: any) => void;

interface HistoryResult {
  context: string;
  values: Array<{ path: string; method: string; source: string | null }>;
  range: { from: string; to: string };
  data: [any];
}

export interface QueryListener {
  onQuery: (options: DataQueryRequest<SignalKQuery>) => void;
}

const NO_OP_HANDLER = (pathValue: PathValue, update: any) => undefined;

export class DataSource extends DataSourceApi<SignalKQuery, SignalKDataSourceOptions> {
  hostname: string;
  ssl: boolean;
  listeners: QueryListener[] = [];
  pathValueHandlers: { [key: string]: PathValueHandler } = {};
  idleInterval?: number;

  ws?: ReconnectingWebsocket;
  url?: string | undefined;

  constructor(instanceSettings: DataSourceInstanceSettings<SignalKDataSourceOptions>) {
    super(instanceSettings);
    this.hostname = instanceSettings.jsonData.hostname || '';
    this.ssl = instanceSettings.jsonData.ssl || false;
    this.url = instanceSettings.url;
  }

  addListener(listener: QueryListener) {
    this.listeners.push(listener);
  }

  removeListener(listener: QueryListener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  ensureWsIsOpen() {
    if (this.ws) {
      return;
    }
    this.ws = new ReconnectingWebsocket(this.getWebsocketUrl());
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.updates) {
        msg.updates.forEach((update: any) => {
          if (update.values) {
            update.values.forEach((pathValue: any) => {
              Object.values(this.pathValueHandlers).forEach((handler) => handler(pathValue, update));
            });
          }
        });
      }
    };
  }

  getWebsocketUrl() {
    return `ws${window.location.protocol === 'https' ? 's' : ''}://${window.location.host}${this.url}/historyapi/signalk/v1/stream`
  }

  query(options: DataQueryRequest<SignalKQuery>): Observable<DataQueryResponse> {
    this.listeners.forEach((l) => l.onQuery(options));

    if (this.idleInterval) {
      clearInterval(this.idleInterval);
      this.idleInterval = undefined;
    }

    const result = new Observable<DataQueryResponse>((subscriber) => {
      let lastStreamingValueTimestamp = 0;

      const dataframe = new DualDataFrame(options.targets.map(
        target => `${target.path}:${target.aggregate}`), 1000);
      const onDataInserted = () => {
        lastStreamingValueTimestamp = Date.now();
        subscriber.next({
          data: [dataframe],
          key: options.targets[0].refId,
          state: LoadingState.Streaming,
        });
      };

      const pathValueHandlerId = `${options.panelId}-${options.dashboardId}-${options.targets[0].refId}`;

      this.pathValueHandlers[pathValueHandlerId] = rangeIsUptoNow(options.rangeRaw)
        ? pathValueHandler(options.targets[0], dataframe, onDataInserted)
        : NO_OP_HANDLER;

      if (rangeIsUptoNow(options.rangeRaw) && options.targets.length > 0) {
        this.ensureWsIsOpen();

        //if there are no updates advance the time with timer
        this.idleInterval = setInterval(() => {
          if (Date.now() - lastStreamingValueTimestamp > 1000) {
            subscriber.next({
              data: [dataframe],
              key: options.targets[0].refId,
            });
          }
        }, 1000) as unknown as number;
      }

      this.doQuery(options, dataframe, subscriber);
    });
    return result;
  }

  async doQuery(options: DataQueryRequest<SignalKQuery>, dataframe: DualDataFrame, subscriber: Subscriber<DataQueryResponse>) {
    //https://community.grafana.com/t/how-to-migrate-from-backendsrv-datasourcerequest-to-backendsrv-fetch/58770
    const observableResponse = getBackendSrv().fetch({
      url: this.getHistoryUrl(options)
    })
    lastValueFrom(observableResponse).then(response => {
      return response.data as unknown as HistoryResult
    })
      .then((result: HistoryResult) => {
        const seriesConversions = options.targets.map(getConversion)
        if (result) {
          result.data.forEach((row: number[]) => {
            const ts = new Date(row[0]);
            dataframe.addHistoryData(ts, row.slice(1).map((value, i) => seriesConversions[i](value)));
          });
          subscriber.next({
            data: [dataframe],
            key: options.targets[0].refId
          })
        }
      });
  }

  getHistoryUrl(options: DataQueryRequest<SignalKQuery>) {
    const paths = options.targets.map((target) => `${target.path}:${target.aggregate || 'average'}`).join(',');
    if (!options.range || !options.range.from || !options.range.to || !options.intervalMs) {
      throw new Error('Valid range and intervalMs required');
    }
    const queryParams: { [k: string]: string } = {
      //FIXME what if targets have different contexts
      context: options.targets[0].context || 'vessels.self',
      paths,
      from: options.range.from.toISOString(),
      to: options.range.to.toISOString(),
      resolution: (options.intervalMs / 1000).toString(),
    };
    let url = `${this.url}/historyapi/signalk/v1/history/values?`;
    Object.keys(queryParams).forEach((key) => (url += `${key}=${queryParams[key]}&`));
    return url.toString();
  }

  async testDatasource() {
    const wsPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws${this.ssl ? 's' : ''}://${this.hostname}/signalk/v1/stream?subscribe=none`);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          //per schema: "required": ["version","roles"]
          if (msg.version && msg.roles) {
            ws.close();
            resolve({
              status: 'success',
              message: 'Success',
            });
            return;
          }
        } catch (e: any) {
          console.error(e.message);
        }
        console.error(event);
        reject({
          status: 'failure',
          message: 'Did not receive Signal K hello message',
        });
      };
      ws.onerror = (error) => {
        console.error(error);
        reject({
          status: 'failure',
          message: `Could not open WebSocket`,
        });
      };
    });

    const apiPromise = fetch(`http${this.ssl ? 's' : ''}://${this.hostname}/signalk/v1/history/values`, {
      credentials: 'include',
    }).then((response) => {
      if (response.status === 400) {
        return {
          status: 'success',
          message: 'Success',
        };
      }
      throw new Error(`History endpoint returned ${response.status}`);
    });

    return Promise.all([wsPromise, apiPromise].map((p: Promise<any>) => p.catch((e: Error) => e))).then((statuses) => {
      if (statuses.some((status) => status.status === 'success')) {
        return Promise.resolve({
          status: 'success',
          message: 'Success',
        });
      }
      return Promise.reject({ status: 'failure', message: `Neither streaming nor http history api works` });
    });
  }

  fetchPaths(range: TimeRange, context: string): Promise<PathWithMeta[]> {
    return fetch(this.getPathsUrl(range, context), {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((paths: string[]) => {
        const validPathPromises: Array<Promise<PathWithMeta | void>> = paths.map((path) => {
          const metaPath = `http${this.ssl ? 's' : ''}://${this.hostname}/signalk/v1/api/vessels/self/${path.split('.').join('/')}/meta`;
          return fetch(metaPath, {
            credentials: 'include',
          })
            .then((res) =>
              res.status === 200
                ? res
                  .json()
                  .then((meta) => ({ path, meta }))
                  .catch((err) => {
                    console.error(err);
                    return Promise.resolve(undefined);
                  })
                : Promise.resolve({ path, meta: {} })
            )
            .catch((err) => {
              console.error(err);
              return Promise.resolve(undefined);
            });
        });
        return Promise.all(validPathPromises).then((pathOrUndefinedA: Array<PathWithMeta | void>): PathWithMeta[] =>
          pathOrUndefinedA.flatMap((f) => (!!f ? [f] : []))
        );
      })
      .catch((err) => {
        console.error(err);
        return [];
      });
  }

  getPathsUrl(range?: TimeRange, context?: string) {
    if (!range) {
      throw new Error('Valid range required for fetching paths');
    }
    const queryParams: { [k: string]: string } = { from: range.from.toISOString(), to: range.to.toISOString() };
    if (context) {
      queryParams.context = context;
    }
    const url: URL = new URL(`http://${this.hostname}/signalk/v1/history/paths`);
    Object.keys(queryParams).forEach((key) => url.searchParams.append(key, queryParams[key]));
    return url.toString();
  }

  fetchContexts(range: TimeRange) {
    return fetch(this.getContextsUrl(range || undefined), {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((contexts) => contexts.map(toLabelValue));
  }

  getContextsUrl(range?: TimeRange) {
    if (!range) {
      throw new Error('Valid range required for fetching contexts');
    }
    const queryParams: { [k: string]: string } = { from: range.from.toISOString(), to: range.to.toISOString() };
    const url: URL = new URL(`http${this.ssl ? 's' : ''}://${this.hostname}/signalk/v1/history/contexts`);
    Object.keys(queryParams).forEach((key) => url.searchParams.append(key, queryParams[key]));
    return url.toString();
  }
}

export const toLabelValue = (s: string) => ({ label: s, value: s });

const getDollarsource = (update: any) => {
  return update.$source ? update.$source : getSourceId(update.source);
};

const getSourceId = (source: any): string => {
  if (source.src || source.pgn) {
    return source.label + (source.src ? '.' + source.src : '') + (source.instance ? '.' + source.instance : '');
  }
  if (source.talker) {
    return source.label + (source.talker ? '.' + source.talker : '.XX');
  }
  if (source.label) {
    return source.label;
  }
  throw new Error(`Can not get sourceId from ${JSON.stringify(source)}`);
};

const rangeIsUptoNow = (rangeRaw?: RawTimeRange) => rangeRaw && rangeRaw.to === 'now';

const pathValueHandler = (
  query: SignalKQuery,
  data: DualDataFrame,
  onDataInserted: () => void
) => {
  const { dollarsource, path } = query
  const conversion = getConversion(query)
  let sourceMatcher: (update: any) => boolean = () => true;
  if (dollarsource && dollarsource !== '') {
    sourceMatcher = (update: any) => getDollarsource(update) === dollarsource;
  }

  return (pathValue: PathValue, update: any) => {
    if (pathValue.path === path) {
      if (sourceMatcher(update)) {
        data.addStreamingData(conversion(pathValue.value));
        onDataInserted();
      }
    }
  };
};

type Conversion = (v: number | null) => (number | null)

const getConversion = (target: SignalKQuery): Conversion => {
  console.log(target)
  if (target.unitConversion) {
    return getConverter(target.unitConversion)
  }
  const multiplier = target.multiplier || 1
  return (x) => x === null ? null : multiplier * x
}
