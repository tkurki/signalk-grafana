import { DataFrame, CircularDataFrame, FieldType, MutableDataFrame } from '@grafana/data';
import { Field, Vector } from '@grafana/data';

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
  fields: Field<any, Vector<any>>[];
  refId?: string | undefined;
  meta?: import('@grafana/data').QueryResultMeta | undefined;
  length: number;
  circularDataFrame: CircularDataFrame;
  mutableDataFrame: MutableDataFrame;
  myVectors: DualProxyVector[];

  constructor(fieldName: string, maxStreamingPoints: number) {
    this.length = 0;

    this.circularDataFrame = new CircularDataFrame({
      append: 'tail',
      capacity: maxStreamingPoints,
    });
    this.mutableDataFrame = new MutableDataFrame();
    [this.circularDataFrame, this.mutableDataFrame].forEach(df => {
      df.addField({ name: 'time', type: FieldType.time });
      df.addField({ name: fieldName, type: FieldType.number });
    });

    this.myVectors = [];
    this.myVectors[0] = new DualProxyVector(this.mutableDataFrame, this.circularDataFrame, 0);
    this.myVectors[1] = new DualProxyVector(this.mutableDataFrame, this.circularDataFrame, 1);

    this.fields = [
      {
        name: 'time',
        type: FieldType.time,
        config: {},
        values: this.myVectors[0],
      },
      {
        name: fieldName,
        type: FieldType.number,
        config: {},
        values: this.myVectors[1],
      },
    ];
  }

  addHistoryData(ts: Date, value: number | null) {
    this.mutableDataFrame.appendRow([ts, value]);
    this.length = this.mutableDataFrame.length + this.circularDataFrame.length;
    this.myVectors.forEach(vector => (vector.length = this.length));
  }

  addStreamingData(value: number) {
    this.circularDataFrame.fields[0].values.add(Date.now());
    this.circularDataFrame.fields[1].values.add(value);
    this.length = this.mutableDataFrame.length + this.circularDataFrame.length;
    this.myVectors.forEach(vector => (vector.length = this.length));
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
  toArray = () => {
    throw new Error('toArray not implemented');
  };
  constructor(historyData: MutableDataFrame, streamData: CircularDataFrame, index: number) {
    this.historyData = historyData;
    this.streamData = streamData;
    this.index = index;
  }
}
