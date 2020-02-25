import React, { PureComponent } from 'react';
import { PanelProps, AbsoluteTimeRange } from '@grafana/data';
import {SystemJS} from '@grafana/runtime';
import { TrackMapOptions } from 'types';
import memoize from 'memoize-one'

interface Props extends PanelProps<TrackMapOptions> {}

interface State {
  currentPoint?: any
}

interface PositionWithTime {
  timestamp: any,
  position: LatLng
}

interface MapParams {
  trackGeojson: LineString
  bounds: any
  pointsByTime: PositionWithTime[],
  getTimeframeByBounds: (b: LatLngBounds) => AbsoluteTimeRange | null
}

import { Map as LeafletMap, GeoJSON, TileLayer, Circle, TileLayerProps } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import { LineString } from 'geojson';
import { LatLngBounds, LatLng } from 'leaflet';
import ValidatingBuffer from 'ValidatingBuffer';

export class TrackMapPanel extends PureComponent<Props, State> {
  constructor(props:Props) {
    super(props)
    // props.onChangeTimeRange({from: new Date('2019-01-01').getTime(), to: new Date('2019-10-01').getTime()})
    SystemJS.load('app/core/app_events').then((appEvents:any) => {
      appEvents.on('graph-hover', (e:any) => {
        const currentPoint = this.pointByTime(e.pos.x)
        if (currentPoint) {
          this.setState({currentPoint: currentPoint.position})
        }
      })
    })
    this.state = {}
  }

  pointByTime(ts:number) {
    return dataToMapParams(this.props.data).pointsByTime.find((pt) => pt.timestamp > ts)
  }

  render() {
    const {bounds, trackGeojson, getTimeframeByBounds} = dataToMapParams(this.props.data)
    const onBoxZoomEnd = ({boxZoomBounds}: {boxZoomBounds: LatLngBounds}) => {
      const timeframe = getTimeframeByBounds(boxZoomBounds)
      if (timeframe) {
        this.props.onChangeTimeRange(timeframe)
      }
    }

    return (
      <LeafletMap onboxzoomend={onBoxZoomEnd} bounds={bounds} style={{width:'100%', height:'100%'}}>
        {this.props.options.layers.map(toTileLayer)}
        <GeoJSON key={Date.now()} data={trackGeojson} />
        {this.state.currentPoint ? <Circle center={this.state.currentPoint} radius={30}/> : undefined}
      </LeafletMap>
    );
  }
}

const toTileLayer = ({url, minZoom, maxZoom, maxNativeZoom, subdomains}: TileLayerProps) =>
  <TileLayer
    url={url}
    minZoom={minZoom}
    maxZoom={maxZoom}
    maxNativeZoom={maxZoom}
    subdomains={subdomains}
  />

const dataToMapParams = memoize((data:any): MapParams => {
  const pointsByTime: PositionWithTime[] = []
  const trackGeojson: LineString = {
    type: 'LineString',
    coordinates: [],
  };

  let i;
  const positions = data.series[0].fields[1].values;
  const timestamps = data.series[0].fields[0].values;
  let minLat = 90
  let maxLat = -90
  let minLng = 180
  let maxLng = -180
  const validatingBuffer = new ValidatingBuffer<any>((points: any[]) => {
    if (points.length === 3 && !points[1]) {
      return false
    }
    const firstSecondDiff = Math.abs(points[0][1] + points[0][1] - points[1][0] - points[1][1])
    const firstLastDiff = Math.abs(points[0][1] + points[0][1] - points[2][0] - points[2][1])
    const secondLastDiff = Math.abs(points[1][1] + points[1][1] - points[2][0] - points[2][1])
    const threshold = firstLastDiff * 2
    const isValid =  firstSecondDiff < threshold && secondLastDiff < threshold
    return isValid
  }, (point:any) => {
    minLat = Math.min(minLat, point[1])
    minLng = Math.min(minLng, point[0])
    maxLat = Math.max(maxLat, point[1])
    maxLng = Math.max(maxLng, point[0])
    trackGeojson.coordinates.push(point);
  })
  for (i = 0; i < positions.length; i++) {
    const position = positions.get(i)
    if (position !== null) {
      pointsByTime.push({timestamp: timestamps.get(i), position: new LatLng(position[1], position[0])})
      validatingBuffer.push(positions.get(i));
    }
  }
  validatingBuffer.flush()

  const bounds = new LatLngBounds([minLat, minLng], [maxLat, maxLng])

  return {
    trackGeojson,
    bounds,
    pointsByTime,
    getTimeframeByBounds: timeframeByBoundsGetter(pointsByTime)
  }
})

function timeframeByBoundsGetter(pointsByTime: PositionWithTime[]) {
  return (bounds: LatLngBounds): AbsoluteTimeRange | null => {
    const timerange = pointsByTime.reduce<AbsoluteTimeRange>((acc, {position, timestamp}) => {
      if (bounds.contains(position)) {
        return {from: Math.min(acc.from, timestamp),to : Math.max(acc.to, timestamp)}
      }
      return acc
    }, {from: Number.POSITIVE_INFINITY, to: 0})

    if (timerange.from <= timerange.to) {
      return timerange
    }
    return null
  }
}
