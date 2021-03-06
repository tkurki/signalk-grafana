import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
  RawTimeRange,
} from '@grafana/data';

import { SignalKQuery, SignalKDataSourceOptions } from './types';
import { Observable, Subscriber } from 'rxjs';
import ReconnectingWebsocket from './reconnecting-websocket';
import { DualDataFrame } from 'DualDataframe';

interface PathValue {
  path: string;
  value: number;
}

type PathValueHandler = (pv: PathValue, update: any) => void;

interface DataSeries {
  dataframe: DualDataFrame;
  key: string;
}

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
  hostname: string;
  listeners: QueryListener[] = [];
  pathValueHandlers: PathValueHandler[] = [];
  idleInterval?: number;

  ws?: ReconnectingWebsocket;

  constructor(instanceSettings: DataSourceInstanceSettings<SignalKDataSourceOptions>) {
    super(instanceSettings);
    this.hostname = instanceSettings.jsonData.hostname || '';
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

  // addPathValueHandler(handler: PathValueHandler) {
  //   this.pathValueHandlers.push(handler);
  // }

  ensureWsIsOpen() {
    if (this.ws) {
      return;
    }
    this.ws = new ReconnectingWebsocket(`ws://${this.hostname}/signalk/v1/stream`);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.pathValueHandlers.forEach((h) => {
        try {
          if (msg.updates) {
            msg.updates.forEach((update: any) => {
              if (update.values) {
                update.values.forEach((pathValue: any) => {
                  this.pathValueHandlers.forEach((handler) => handler(pathValue, update));
                });
              }
            });
          }
        } catch (e) {
          console.error(e.message);
        }
      });
    };
  }

  query(options: DataQueryRequest<SignalKQuery>): Observable<DataQueryResponse> {
    this.listeners.forEach((l) => l.onQuery(options));
    // this.pathValueHandlers = [];

    if (this.idleInterval) {
      clearInterval(this.idleInterval);
      this.idleInterval = undefined;
    }

    const result = new Observable<DataQueryResponse>((subscriber) => {
      let lastStreamingValueTimestamp = 0;

      const series: DataSeries[] = options.targets.map((target) => {
        //push empty data so that the values are registered always in order
        //otherwise the path that produces data first will be the first
        //series in grafana, making the order undeterministic
        subscriber.next({
          data: [],
          key: target.refId,
          state: LoadingState.Streaming,
        });

        const data = new DualDataFrame(`${target.path}:${target.aggregate}`, 1000);
        data.refId = target.refId;

        const onDataInserted = () => {
          lastStreamingValueTimestamp = Date.now();
          subscriber.next({
            data: [data],
            key: target.refId,
            state: LoadingState.Streaming,
          });
        };

        if (rangeIsUptoNow(options.rangeRaw)) {
          this.pathValueHandlers.push(
            pathValueHandler(target.path, data, onDataInserted, target.dollarsource, target.multiplier)
          );
        }
        return {
          dataframe: data,
          key: target.refId,
        };
      });

      if (rangeIsUptoNow(options.rangeRaw) && options.targets.length > 0) {
        this.ensureWsIsOpen();

        //if there are no updates advance the time with timer
        this.idleInterval = setInterval(() => {
          if (Date.now() - lastStreamingValueTimestamp > 1000) {
            subscriber.next({
              data: [series[0].dataframe],
              key: series[0].dataframe.refId,
            });
          }
        }, 1000) as unknown as number;
      }

      this.doQuery(options, series, subscriber);
    });
    return result;
  }

  doQuery(options: DataQueryRequest<SignalKQuery>, series: DataSeries[], subscriber: Subscriber<DataQueryResponse>) {
    fetch(this.getHistoryUrl(options))
      .then((response) => (response.ok ? response.json() : null))
      .then((result: HistoryResult) => {
        if (result) {
          result.data.forEach((row) => {
            const ts = new Date(row[0]);
            series.forEach((serie, i) => {
              let value = row[i + 1];
              if (typeof value === 'number') {
                value = value * (options.targets[i].multiplier === undefined ? 1 : options.targets[i].multiplier);
              }
              serie.dataframe.addHistoryData(ts, value);
            });
          });
          series.forEach((serie) => {
            subscriber.next({
              data: [serie.dataframe],
              key: serie.key,
            });
          });
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
    const url: URL = new URL(`http://${this.hostname}/signalk/v1/history/values`);
    Object.keys(queryParams).forEach((key) => url.searchParams.append(key, queryParams[key]));
    return url.toString();
  }

  async testDatasource() {
    const wsPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${this.hostname}/signalk/v1/stream?subscribe=none`);
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
        } catch (e) {
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

    const apiPromise = fetch(`http://${this.hostname}/signalk/v1/history/values`).then((response) => {
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
}

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
  path: string,
  data: DualDataFrame,
  onDataInserted: () => void,
  dollarsource?: string,
  multiplier?: number
) => {
  let sourceMatcher: (update: any) => boolean = () => true;
  if (dollarsource && dollarsource !== '') {
    sourceMatcher = (update: any) => getDollarsource(update) === dollarsource;
  }

  return (pathValue: PathValue, update: any) => {
    if (pathValue.path === path) {
      if (sourceMatcher(update)) {
        data.addStreamingData(pathValue.value * (multiplier || 1));
        onDataInserted();
      }
    }
  };
};
