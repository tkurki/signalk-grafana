import { DataQueryRequest, DataQueryResponse, DataSourceApi, DataSourceInstanceSettings, FieldType, CircularDataFrame } from '@grafana/data';

import { SignalKQuery, SignalKDataSourceOptions } from './types';
import { Observable, Subscriber } from 'rxjs';
import ReconnectingWebsocket from './reconnecting-websocket';

interface PathValue {
  path: string;
  value: number;
}

type PathValueHandler = (pv: PathValue, update: any) => void;

interface DataSeries {
  dataframe: CircularDataFrame;
  pathValueHandler: PathValueHandler;
  key: string;
}

export interface QueryListener {
  onQuery: (options: DataQueryRequest<SignalKQuery>) => void;
}

export class DataSource extends DataSourceApi<SignalKQuery, SignalKDataSourceOptions> {
  hostname: string;
  listeners: Array<QueryListener> = [];
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

  query(options: DataQueryRequest<SignalKQuery>): Observable<DataQueryResponse> {
    this.listeners.forEach(l => l.onQuery(options));
    console.log(options);

    return new Observable<DataQueryResponse>(subscriber => {
      const maxDataPoints = options.maxDataPoints || 1000;
      const intervals: number[] = [];
      let lastStreamingValueTimestamp = 0;

      const series: Array<DataSeries> = options.targets.map((target, i) => {
        const data = new CircularDataFrame({
          append: 'tail',
          capacity: maxDataPoints,
        });

        data.refId = target.refId;
        data.name = target.path;
        data.addField({ name: 'time', type: FieldType.time });
        data.addField({ name: `${target.path}${target.dollarsource ? `$${target.dollarsource}` : ''}`, type: FieldType.number });

        const addNextRow = (value: number, time: number) => {
          data.fields[0].values.add(time);
          data.fields[1].values.add(value);
        };

        const pushNextEvent = (value: number) => {
          addNextRow(value * (target.multiplier || 1), Date.now());
          subscriber.next({
            data: [data],
            key: target.refId,
          });
        };
        //push empty data so that the values are registered always in order
        //otherwise the path that produces data first will be the first
        //series in grafana, making the order undeterministic
        subscriber.next({
          data: [],
          key: target.refId,
        });


        let sourceMatcher: (update: any) => boolean = () => true;
        if (target.dollarsource && target.dollarsource !== '') {
          sourceMatcher = (update: any) => getDollarsource(update) === target.dollarsource;
        }

        const pathValueHandler = (pathValue: PathValue, update: any) => {
          if (pathValue.path === target.path) {
            if (sourceMatcher(update)) {
              pushNextEvent(pathValue.value);
              lastStreamingValueTimestamp = Date.now();
            }
          }
        };
        return {
          dataframe: data,
          pathValueHandler,
          key: target.refId,
        };
      });

      doQuery(options, series, subscriber);

      let ws: ReconnectingWebsocket;
      if (options.rangeRaw && options.rangeRaw.to === 'now') {
        ws = new ReconnectingWebsocket(`ws://${this.hostname}/signalk/v1/stream`);
        ws.onmessage = event => {
          const msg = JSON.parse(event.data);
          if (msg.updates) {
            msg.updates.forEach((update: any) => {
              if (update.values) {
                update.values.forEach((pathValue: any) => {
                  series.forEach(dataseries => dataseries.pathValueHandler(pathValue, update));
                });
              }
            });
          }
        };

        intervals.push(
          setInterval(() => {
            if (Date.now() - lastStreamingValueTimestamp > 1000) {
              subscriber.next({
                data: [data],
                key: target.refId,
              });
            }
          }, 1000)
        );
      }
      return () => {
        ws && ws.close();
        intervals.forEach(interval => clearInterval(interval));
      };
    });
  }

  async testDatasource() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${this.hostname}/signalk/v1/stream?subscribe=none`);
      ws.onmessage = event => {
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
      ws.onerror = error => {
        console.error(error);
        reject({
          status: 'failure',
          message: `Could not open WebSocket`,
        });
      };
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

interface HistoryResult {
  context: string;
  values: Array<{ path: string; method: string; source: string | null }>;
  range: { from: string; to: string };
  data: [any];
}

const doQuery = (options: DataQueryRequest<SignalKQuery>, series: Array<DataSeries>, subscriber: Subscriber<DataQueryResponse>) => {
  fetch(getHistoryUrl(options))
    .then(response => response.json())
    .then((result: HistoryResult) => {
      result.data.forEach(row => {
        const ts = new Date(row[0]);
        series.forEach((serie, i) => {
          serie.dataframe.fields[0].values.add(ts);
          serie.dataframe.fields[1].values.add(row[i + 1]);
        });
      });
      series.forEach(serie => {
        subscriber.next({
          data: [serie.dataframe],
          key: serie.key,
        });
      });
    });
};

const getHistoryUrl = (options: DataQueryRequest<SignalKQuery>) => {
  const paths = options.targets.map(target => target.path).join(',');
  const queryParams: { [k: string]: string } = {
    context: options.targets[0].context,
    paths,
    from: options.range.from.toISOString(),
    to: options.range.to.toISOString(),
    resolution: (options.intervalMs / 1000).toString(),
  };
  const url: URL = new URL(`http://localhost:3000/signalk/v1/history/values`);
  Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
  return url.toString();
};
