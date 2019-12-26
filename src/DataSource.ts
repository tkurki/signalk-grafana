import { DataQueryRequest, DataQueryResponse, DataSourceApi, DataSourceInstanceSettings, FieldType, CircularDataFrame } from '@grafana/data';

import { MyQuery, MyDataSourceOptions } from './types';
import { Observable } from 'rxjs';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {
    console.log(options);

    return new Observable<DataQueryResponse>(subscriber => {
      const streamId = `stream-${options.requestId}`;
      const maxDataPoints = options.maxDataPoints || 1000;

      const data = new CircularDataFrame({
        append: 'tail',
        capacity: maxDataPoints,
      });

      // data.refId = target.refId;
      // data.name = target.alias || 'Signal ' + target.refId;
      data.addField({ name: 'time', type: FieldType.time });
      data.addField({ name: 'value', type: FieldType.number });

      const addNextRow = (value: number, time: number) => {
        data.fields[0].values.add(time);
        data.fields[1].values.add(value);
      };

      const ws = new WebSocket('ws://demo.signalk.org/signalk/v1/stream');
      ws.onmessage = event => {
        const msg = JSON.parse(event.data);
        msg.updates &&
          msg.updates.forEach((update: any) => {
            update.values &&
              update.values.forEach((pathValue: any) => {
                if (pathValue.path === 'navigation.speedOverGround') {
                  pushNextEvent(pathValue.value);
                }
              });
          });
      };

      const pushNextEvent = (value: number) => {
        addNextRow(value, Date.now());
        subscriber.next({
          data: [data],
          key: streamId,
        });
      };


      return () => {
        console.log('unsubscribing to stream ' + streamId);
        ws.close();
      };
    });
  }

  async testDatasource() {
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
