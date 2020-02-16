import { PanelPlugin } from '@grafana/data';
import { TrackMapOptions, defaults } from './types';
import { TrackMapPanel } from './TrackMapPanel';
import { TrackMapEditor } from './TrackMapEditor';

export const plugin = new PanelPlugin<TrackMapOptions>(TrackMapPanel).setDefaults(defaults).setEditor(TrackMapEditor);
