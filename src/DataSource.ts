import { DataQueryRequest, DataQueryResponse, DataSourceApi, DataSourceInstanceSettings, FieldType, CircularDataFrame } from '@grafana/data';

import { SignalKQuery, SignalKDataSourceOptions } from './types';
import { Observable } from 'rxjs';

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
    return new Observable<DataQueryResponse>(subscriber => {
      const maxDataPoints = options.maxDataPoints || 1000;

      const pathValueHandlers: ((pv: PathValue) => void)[] = options.targets.map((target, i) => {
        const data = new CircularDataFrame({
          append: 'tail',
          capacity: maxDataPoints,
        });

        data.refId = target.refId;
        data.name = target.path;
        data.addField({ name: 'time', type: FieldType.time });
        data.addField({ name: target.path, type: FieldType.number });

        const addNextRow = (value: number, time: number) => {
          data.fields[0].values.add(time);
          data.fields[1].values.add(value);
        };

        const pushNextEvent = (value: number) => {
          addNextRow(value, Date.now());
          subscriber.next({
            data: [data],
            key: target.refId,
          });
        };

        return (pathValue: PathValue) => {
          if (pathValue.path === target.path) {
            pushNextEvent(pathValue.value);
          }
        };
      });

      const ws = new WebSocket(`ws://${this.hostname}/signalk/v1/stream`);
      ws.onmessage = event => {
        const msg = JSON.parse(event.data);
        msg.updates &&
          msg.updates.forEach((update: any) => {
            update.values &&
              update.values.forEach((pathValue: any) => {
                pathValueHandlers.forEach(pm => pm(pathValue));
              });
          });
      };

      return () => {
        ws.close();
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
        console.error(error)
        reject({
          status: 'failure',
          message: `Could not open WebSocket`,
        });
      }
    });
  }
}
