import { PanelPlugin } from '@grafana/data';
import { TrackMapOptions } from './types';
import { TrackMapPanel } from './TrackMapPanel';

export const plugin = new PanelPlugin<TrackMapOptions>(TrackMapPanel).setPanelOptions((builder) => {
  return builder.addColorPicker({
    path: 'trackColor',
    name: 'Track color',
    defaultValue: '#0000ff'
  }).addColorPicker({
    path: 'pointColor',
    name: 'Point color',
    defaultValue: '#ff0000'
  })
});

