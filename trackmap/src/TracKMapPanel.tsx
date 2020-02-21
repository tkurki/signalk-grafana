import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import {SystemJS} from '@grafana/runtime';
import { TrackMapOptions } from 'types';

interface Props extends PanelProps<TrackMapOptions> {}

interface State {
  currentPoint?: any
}

interface PositionWithTime {
  timestamp: any,
  position: any
}

import { Map as LeafletMap, GeoJSON, TileLayer, Circle } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import { LineString } from 'geojson';
import { LatLngBounds } from 'leaflet';
import ValidatingBuffer from 'ValidatingBuffer';

export class TrackMapPanel extends PureComponent<Props, State> {
  pointsByTime: PositionWithTime[] = []
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
    return this.pointsByTime.find((pt) => pt.timestamp > ts)
  }
  render() {
    const points: LineString = {
      type: 'LineString',
      coordinates: [],
    };

    let i;
    const positions = this.props.data.series[0].fields[1].values;
    const timestamps = this.props.data.series[0].fields[0].values;
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
      points.coordinates.push(point);
    })
    for (i = 0; i < positions.length; i++) {
      const position = positions.get(i)
      if (position !== null) {
        this.pointsByTime.push({timestamp: timestamps.get(i), position})
        validatingBuffer.push(positions.get(i));
      }
    }
    validatingBuffer.flush()

    const bounds = new LatLngBounds([minLat, minLng], [maxLat, maxLng])
    console.log(this.state.currentPoint)
    return (
      <LeafletMap bounds={bounds} style={{width:'100%', height:'100%'}} >
        <TileLayer url={'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} minZoom={0} maxZoom={20} />
        <TileLayer url={'https://signalk-stash.chacal.fi/map/v1/{z}/{x}/{y}.png'} minZoom={8} maxZoom={15} />
        <TileLayer
          url={'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'}
          minZoom={16}
          maxNativeZoom={20}
          maxZoom={21}
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        />
        <TileLayer url={'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'} minZoom={16} maxZoom={21} maxNativeZoom={18} />
        <GeoJSON key={Date.now()} data={points} />
        {this.state.currentPoint ? <Circle center={[this.state.currentPoint[1], this.state.currentPoint[0]]} radius={30}/> : undefined}
      </LeafletMap>
    );
  }
}
