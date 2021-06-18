import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  CircularDataFrame,
  LoadingState,
} from '@grafana/data';

import { SignalKQuery, SignalKDataSourceOptions } from './types';
import { Observable } from 'rxjs';
import ReconnectingWebsocket from './reconnecting-websocket';

interface PathValue {
  path: string;
  value: number;
}

export class DataSource extends DataSourceApi<SignalKQuery, SignalKDataSourceOptions> {
  hostname: string;
  constructor(instanceSettings: DataSourceInstanceSettings<SignalKDataSourceOptions>) {
    super(instanceSettings);
    this.hostname = instanceSettings.jsonData.hostname || '';
  }

  query(options: DataQueryRequest<SignalKQuery>): Observable<DataQueryResponse> {
    return new Observable<DataQueryResponse>((subscriber) => {
      const maxDataPoints = options.maxDataPoints || 1000;
      const intervals: NodeJS.Timeout[] = [];

      const pathValueHandlers: Array<(pv: PathValue, update: any) => void> = options.targets.map((target, i) => {
        const data = new CircularDataFrame({
          append: 'tail',
          capacity: maxDataPoints,
        });

        data.refId = target.refId;
        data.name = target.path;
        data.addField({ name: 'time', type: FieldType.time });
        const dataFieldName = `${target.path}${target.dollarsource ? `$${target.dollarsource}` : ''}` 
        data.addField({
          name: dataFieldName,
          type: FieldType.number,
        });

        const pushNextEvent = (value: number) => {
          const datum: any = {time: Date.now()}
          datum[dataFieldName] = value * (target.multiplier || 1)
          data.add(datum)
          subscriber.next({
            data: [data],
            key: target.refId,
            state: LoadingState.Streaming
          });
        };
        //push empty data so that the values are registered always in order
        //otherwise the path that produces data first will be the first
        //series in grafana, making the order undeterministic
        subscriber.next({
          data: [],
          key: target.refId,
        });

        let lastValueTimestamp = 0;
        intervals.push(
          setInterval(() => {
            if (Date.now() - lastValueTimestamp > 1000) {
              subscriber.next({
                data: [data],
                key: target.refId,
              });
            }
          }, 1000)
        );

        let sourceMatcher: (update: any) => boolean = () => true;
        if (target.dollarsource && target.dollarsource !== '') {
          sourceMatcher = (update: any) => getDollarsource(update) === target.dollarsource;
        }

        return (pathValue: PathValue, update: any) => {
          if (pathValue.path === target.path) {
            if (sourceMatcher(update)) {
              pushNextEvent(pathValue.value);
              lastValueTimestamp = Date.now();
            }
          }
        };
      });

      const ws = new ReconnectingWebsocket(`ws://${this.hostname}/signalk/v1/stream`);
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.updates) {
          msg.updates.forEach((update: any) => {
            if (update.values) {
              update.values.forEach((pathValue: any) => {
                pathValueHandlers.forEach((pm) => pm(pathValue, update));
              });
            }
          });
        }
      };

      return () => {
        ws.close();
        intervals.forEach((interval) => clearInterval(interval));
      };
    });
  }

  async testDatasource() {
    return new Promise((resolve, reject) => {
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
