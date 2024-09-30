import {
  CircularDataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  LoadingState,
  RawTimeRange,
  TimeRange,
} from '@grafana/data';

import { SignalKQuery, SignalKDataSourceOptions } from './types';
import { Observable, Subscriber, lastValueFrom } from 'rxjs';
import ReconnectingWebsocket from './reconnecting-websocket';
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

export class DataSource extends DataSourceApi<SignalKQuery, SignalKDataSourceOptions> {
  ssl: boolean;
  useAuth: boolean;
  listeners: QueryListener[] = [];
  pathValueHandlers: PathValueHandler[] = [];
  idleInterval?: number;

  ws?: ReconnectingWebsocket;
  url?: string | undefined;

  constructor(instanceSettings: DataSourceInstanceSettings<SignalKDataSourceOptions>) {
    super(instanceSettings);
    this.ssl = instanceSettings.jsonData.ssl || false;
    this.useAuth = instanceSettings.jsonData.useAuth || false;
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

  closeWs() {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
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
              this.pathValueHandlers.forEach((handler) => handler(pathValue, update));
            });
          }
        });
      }
    };
  }

  getProxyName() {
    return `${this.ssl ? 's' : ''}${this.useAuth ? '' : 'noauth'}historyapi`;
  }

  getWebsocketUrl() {
    return `ws${window.location.protocol === 'https' ? 's' : ''}://${window.location.host}${
      this.url
    }/${this.getProxyName()}/signalk/v1/stream`;
  }

  query(options: DataQueryRequest<SignalKQuery>): Observable<DataQueryResponse> {
    this.listeners.forEach((l) => l.onQuery(options));

    if (this.idleInterval) {
      clearInterval(this.idleInterval);
      this.idleInterval = undefined;
    }

    const result = new Observable<DataQueryResponse>((subscriber) => {
      let lastStreamingValueTimestamp = 0;

      const dataframe = new CircularDataFrame({
        append: 'tail',
        capacity: 1000,
      });
      dataframe.addField({ name: 'time', type: FieldType.time });
      options.targets.map((target) => {
        dataframe.addField({ name: `${target.path}:${target.aggregate}`, type: FieldType.number });
      });

      const onDataInserted = () => {
        lastStreamingValueTimestamp = Date.now();
        subscriber.next({
          data: [dataframe],
          key: options.targets[0].refId,
          state: LoadingState.Streaming,
        });
      };

      this.pathValueHandlers = !rangeIsUptoNow(options.rangeRaw)
        ? []
        : options.targets.map((target, i) => pathValueHandler(target, dataframe, i, onDataInserted));

      if (rangeIsUptoNow(options.rangeRaw) && options.targets.length > 0) {
        this.ensureWsIsOpen();

        //if there are no updates advance the time with timer
        this.idleInterval = setInterval(() => {
          if (Date.now() - lastStreamingValueTimestamp > options.intervalMs) {
            subscriber.next({
              data: [dataframe],
              state: LoadingState.Streaming,
            });
          }
        }, options.intervalMs) as unknown as number;
      }

      this.doQuery(options, dataframe, subscriber);
    });
    return onFirstLastSubscribers(
      result,
      () => this.ensureWsIsOpen(),
      () => this.closeWs()
    );
  }

  async doQuery(
    options: DataQueryRequest<SignalKQuery>,
    dataframe: CircularDataFrame,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    //https://community.grafana.com/t/how-to-migrate-from-backendsrv-datasourcerequest-to-backendsrv-fetch/58770
    const observableResponse = getBackendSrv().fetch({
      url: this.getHistoryUrl(options),
    });
    lastValueFrom(observableResponse)
      .then((response) => {
        return response.data as unknown as HistoryResult;
      })
      .then((result: HistoryResult) => {
        const seriesConversions = options.targets.map(getConversion);
        if (result) {
          result.data.forEach((row: number[]) => {
            const rowToInsert = row.slice(1).map((value, i) => seriesConversions[i](value));
            const ts = new Date(row[0]);
            (rowToInsert as any[]).unshift(ts);
            dataframe.appendRow(rowToInsert);
          });
          subscriber.next({
            data: [dataframe],
            key: options.targets[0].refId,
          });
        }
      });
  }

  getHistoryUrlBase() {
    return `${this.url}/${this.getProxyName()}/signalk/v1/history/values?`;
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
    return urlWithQueryParams(this.getHistoryUrlBase(), queryParams);
  }

  async testDatasource() {
    const wsPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.getWebsocketUrl()}?subscribe=none`);
      setTimeout(() => {
        try {
          ws.close();
        } catch (e) {
          console.error(e);
        }
        //if resolved already has no effect
        reject('WebSocket timeout');
      }, 10 * 1000);
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

    const observableResponse = getBackendSrv().fetch({ url: this.getHistoryUrlBase() });
    const apiPromise = lastValueFrom(observableResponse).then((response) => {
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
    const observableResponse = getBackendSrv().fetch({ url: this.getPathsUrl(range, context) });
    return lastValueFrom(observableResponse)
      .then((response) => {
        return response.data as unknown as string[];
      })
      .then((paths: string[]) => {
        return paths.map((path) => {
          let fetched = false;
          let _meta: any;
          return {
            path,
            meta: () => {
              if (!fetched) {
                const observableResponse = getBackendSrv().fetch({
                  url: `${this.url}/historyapi/signalk/v1/api/vessels/self/${path.split('.').join('/')}/meta`,
                });
                _meta = lastValueFrom(observableResponse).then((response) => {
                  fetched = true;
                  return response.data;
                });
              }
              return _meta;
            },
          };
        });
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
    return urlWithQueryParams(`${this.url}/historyapi/signalk/v1/history/paths?`, queryParams);
  }

  fetchContexts(range: TimeRange) {
    const observableResponse = getBackendSrv().fetch({ url: this.getContextsUrl(range || undefined) });
    return lastValueFrom(observableResponse)
      .then((response) => {
        return response.data as unknown as string[];
      })
      .then((contexts) => contexts.map(toLabelValue));
  }

  getContextsUrl(range?: TimeRange) {
    if (!range) {
      throw new Error('Valid range required for fetching contexts');
    }
    return urlWithQueryParams(`${this.url}/historyapi/signalk/v1/history/contexts?`, {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
  }
}

const urlWithQueryParams = (base: string, queryParams: { [k: string]: string }) => {
  let url = base;
  Object.keys(queryParams).forEach((key) => (url += `${key}=${queryParams[key]}&`));
  return url;
};
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
  data: CircularDataFrame,
  fieldIndex: number,
  onDataInserted: () => void
) => {
  const { dollarsource, path } = query;
  const conversion = getConversion(query);
  let sourceMatcher: (update: any) => boolean = () => true;
  if (dollarsource && dollarsource !== '') {
    sourceMatcher = (update: any) => getDollarsource(update) === dollarsource;
  }

  return (pathValue: PathValue, update: any) => {
    if (pathValue.path === path) {
      if (sourceMatcher(update)) {
        const row = new Array<number | null>(data.fields.length);
        row[0] = Date.now();
        row[fieldIndex + 1] = conversion(pathValue.value);
        data.appendRow(row);
        onDataInserted();
      }
    }
  };
};

type Conversion = (v: number | null) => number | null;

const getConversion = (seriesQuery: SignalKQuery): Conversion => {
  if (seriesQuery.path === 'navigation.position') {
    return (x) => x;
  }
  if (seriesQuery.unitConversion) {
    const converter = getConverter(seriesQuery.unitConversion);
    return (x) => (x === null ? null : converter(x));
  }
  const multiplier = seriesQuery.multiplier || 1;
  return (x) => (x === null ? null : multiplier * x);
};

function onFirstLastSubscribers<T>(
  sourceObservable: Observable<T>,
  onFirstSubscriber: () => void,
  onLastUnsubscribe: () => void
) {
  let subscriptionCount = 0;
  return new Observable((subscriber: Subscriber<T>) => {
    if (subscriptionCount === 0) {
      onFirstSubscriber();
    }
    subscriptionCount++;
    const subscription = sourceObservable.subscribe(subscriber);
    return () => {
      subscriptionCount--;
      subscription.unsubscribe();
      if (subscriptionCount === 0) {
        onLastUnsubscribe();
      }
    };
  });
}
