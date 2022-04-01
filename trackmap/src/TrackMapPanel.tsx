import React, { PureComponent } from 'react';
import { PanelProps, AbsoluteTimeRange, LegacyGraphHoverEvent } from '@grafana/data';
import { TrackMapOptions } from 'types';
import memoize from 'memoize-one';
import { interpolateRdYlBu } from 'd3-scale-chromatic';

interface Props extends PanelProps<TrackMapOptions> {}

interface State {
  currentPoint?: any;
}

interface PositionWithTime {
  timestamp: any;
  position: LatLng;
  value?: number;
}

interface MapParams {
  trackGeojson: LineString;
  bounds: any;
  pointsByTime: PositionWithTime[];
  getTimeframeByBounds: (b: LatLngBounds) => AbsoluteTimeRange | null;
  hasDataValues: boolean;
}

import { Map as LeafletMap, GeoJSON, TileLayer, CircleMarker, TileLayerProps, Tooltip, Pane } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import { LineString } from 'geojson';
import { LatLngBounds, LatLng } from 'leaflet';
import ValidatingBuffer from 'ValidatingBuffer';

export class TrackMapPanel extends PureComponent<Props, State> {
  cursorSubscription: any; //RxJs Subscription
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  pointByTime(ts: number) {
    //FIXME dataToMapParams only when data changes
    return dataToMapParams(this.props.data).pointsByTime.find((pt) => pt.timestamp > ts);
  }

  componentDidMount() {
    this.cursorSubscription = this.props.eventBus.getStream(LegacyGraphHoverEvent).subscribe({
      next: (evt) => {
        const currentPoint = this.pointByTime(evt.payload.point.time);
        if (currentPoint) {
          this.setState({ currentPoint: currentPoint.position });
        }
      },
    });
  }

  componentWillUnmount() {
    this.cursorSubscription.unsubscribe();
  }

  render() {
    //FIXME dataToMapParams only when data changes
    const { bounds, trackGeojson, getTimeframeByBounds, pointsByTime, hasDataValues } = dataToMapParams(
      this.props.data
    );
    const onBoxZoomEnd = ({ boxZoomBounds }: { boxZoomBounds: LatLngBounds }) => {
      const timeframe = getTimeframeByBounds(boxZoomBounds);
      if (timeframe) {
        this.props.onChangeTimeRange(timeframe);
      }
    };

    return (
      <LeafletMap onboxzoomend={onBoxZoomEnd} bounds={bounds} style={{ width: '100%', height: '100%' }}>
        {this.props.options.layers.map(toTileLayer)}
        <GeoJSON key={Date.now()} data={trackGeojson} />
        {hasDataValues && (
          <Pane style={{ zIndex: 899 }}>
            {pointsByTime.map(({ position, value }, i) => (
              <CircleMarker
                key={i}
                center={position}
                color={interpolateRdYlBu(Math.min(1, (value || 10) / 10))}
                radius={1}
              >
                <Tooltip>{value?.toFixed(1)}</Tooltip>
              </CircleMarker>
            ))}
          </Pane>
        )}
        <Pane style={{ zIndex: 999 }}>
          {this.state.currentPoint ? <CircleMarker center={this.state.currentPoint} radius={5} /> : undefined}
        </Pane>
      </LeafletMap>
    );
  }
}

const toTileLayer = ({ url, minZoom, maxZoom, maxNativeZoom, subdomains }: TileLayerProps) => (
  <TileLayer url={url} minZoom={minZoom} maxZoom={maxZoom} maxNativeZoom={maxZoom} subdomains={subdomains} />
);

const dataToMapParams = memoize((data: any): MapParams => {
  const pointsByTime: PositionWithTime[] = [];
  const trackGeojson: LineString = {
    type: 'LineString',
    coordinates: [],
  };

  let i;
  const positions = data.series[0].fields[1].values;
  const timestamps = data.series[0].fields[0].values;
  const dataValues = data.series.length > 1 ? data.series[1].fields[1].values : undefined;
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  const validatingBuffer = new ValidatingBuffer<any>(
    (points: any[]) => {
      if (points.length === 3 && !points[1]) {
        return false;
      }
      const firstSecondDiff = Math.abs(points[0][1] + points[0][1] - points[1][0] - points[1][1]);
      const firstLastDiff = Math.abs(points[0][1] + points[0][1] - points[2][0] - points[2][1]);
      const secondLastDiff = Math.abs(points[1][1] + points[1][1] - points[2][0] - points[2][1]);
      const threshold = firstLastDiff * 2;
      const isValid = firstSecondDiff < threshold && secondLastDiff < threshold;
      return isValid;
    },
    (point: any) => {
      minLat = Math.min(minLat, point[1]);
      minLng = Math.min(minLng, point[0]);
      maxLat = Math.max(maxLat, point[1]);
      maxLng = Math.max(maxLng, point[0]);
      trackGeojson.coordinates.push(point);
    }
  );
  for (i = 0; i < positions.length; i++) {
    const position = positions.get(i);
    if (
      position !== null &&
      Array.isArray([position]) &&
      typeof position[0] === 'number' &&
      typeof position[1] === 'number'
    ) {
      const timePoint: PositionWithTime = {
        timestamp: timestamps.get(i),
        position: new LatLng(position[1], position[0]),
      };
      if (dataValues) {
        timePoint.value = dataValues.get(i);
      }
      pointsByTime.push(timePoint);
      validatingBuffer.push(position);
    }
  }
  validatingBuffer.flush();

  const bounds = new LatLngBounds([minLat, minLng], [maxLat, maxLng]);

  return {
    trackGeojson,
    bounds,
    pointsByTime,
    getTimeframeByBounds: timeframeByBoundsGetter(pointsByTime),
    hasDataValues: !!dataValues,
  };
});

function timeframeByBoundsGetter(pointsByTime: PositionWithTime[]) {
  return (bounds: LatLngBounds): AbsoluteTimeRange | null => {
    const timerange = pointsByTime.reduce<AbsoluteTimeRange>(
      (acc, { position, timestamp }) => {
        if (bounds.contains(position)) {
          return { from: Math.min(acc.from, timestamp), to: Math.max(acc.to, timestamp) };
        }
        return acc;
      },
      { from: Number.POSITIVE_INFINITY, to: 0 }
    );

    if (timerange.from <= timerange.to) {
      return timerange;
    }
    return null;
  };
}
