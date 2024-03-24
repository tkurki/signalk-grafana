import { Field, Vector, DataFrame, CircularDataFrame, FieldType, MutableDataFrame } from '@grafana/data';

/*
  DataFrame that holds
  - historical data, that is retrieved once and never changes
  - streaming data, that is updated as time progresses and
  new values are added
  Historical Data is already sampled per the query. If streaming
  is active long enough and the time window is short this data
  may slide out of the displayed time window.
  Streaming data is updated arbitrarily and should be downsampled to
  the precision that is displayed as time goes by and processed for
  aggregates (min/max/avg/median). Furthermore streaming data should be
  discarded as it rolls off the display window.

  This naive implementation uses a fixed CircularDataFrame for streaming data.
 */
export class DualDataFrame implements DataFrame {
  name?: string | undefined;
  fields: Array<Field<any, Vector<any>>>;
  refId?: string | undefined;
  meta?: import('@grafana/data').QueryResultMeta | undefined;
  length: number;
  circularDataFrame: CircularDataFrame;
  mutableDataFrame: MutableDataFrame;
  myVectors: DualProxyVector[];

  constructor(fieldNames: string[], maxStreamingPoints: number) {
    this.length = 0;

    this.circularDataFrame = new CircularDataFrame({
      append: 'tail',
      capacity: maxStreamingPoints,
    });
    this.mutableDataFrame = new MutableDataFrame();
    [this.circularDataFrame, this.mutableDataFrame].forEach((df) => {
      df.addField({ name: 'time', type: FieldType.time });
      fieldNames.forEach(fieldName =>
        df.addField({ name: fieldName, type: FieldType.number }));
    });

    this.myVectors = [new DualProxyVector(this.mutableDataFrame, this.circularDataFrame, 0),
    ...fieldNames.map((fieldName, i) => new DualProxyVector(this.mutableDataFrame, this.circularDataFrame, i+1))]

    this.fields = [
      {
        name: 'time',
        type: FieldType.time,
        config: {},
        values: this.myVectors[0],
      },
      ...fieldNames.map((fieldName, i) => ({
        name: fieldName,
        type: FieldType.number,
        config: {},
        values: this.myVectors[i+1],
      }
      ))
    ];
  }

  addHistoryData(ts: Date, values: Array<number | null>) {
    this.length = this.mutableDataFrame.length + this.circularDataFrame.length;
    this.mutableDataFrame.appendRow([ts, ...values]);
    this.myVectors.forEach((vector) => (vector.length = this.length));
  }

  addStreamingData(fieldIndex: number, value: number | null) {
    const row = new Array<number | null>(this.circularDataFrame.fields.length)
    row[0] = Date.now();
    row[fieldIndex +1 ] = value
    this.circularDataFrame.appendRow(row)
    this.length = this.mutableDataFrame.length + this.circularDataFrame.length;
    this.myVectors.forEach((vector) => (vector.length = this.length));
  }
}

class DualProxyVector implements Vector {
  index: number;
  historyData: MutableDataFrame;
  streamData: CircularDataFrame;
  length = 0;
  get = (index: number) => {
    const historyLength = this.historyData.length;
    if (index < historyLength) {
      return this.historyData.fields[this.index].values.get(index);
    } else {
      return this.streamData.fields[this.index].values.get(index - historyLength);
    }
  };
  toArray = () =>
    this.historyData.fields[this.index].values.toArray().concat(this.streamData.fields[this.index].values.toArray());

  constructor(historyData: MutableDataFrame, streamData: CircularDataFrame, index: number) {
    this.historyData = historyData;
    this.streamData = streamData;
    this.index = index;
  }
}
