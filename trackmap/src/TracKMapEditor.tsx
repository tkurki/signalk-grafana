import React, { PureComponent } from 'react';
import { ColorPicker, FormLabel } from '@grafana/ui';
import { PanelEditorProps } from '@grafana/data';

import { TrackMapOptions } from './types';

export class TrackMapEditor extends PureComponent<PanelEditorProps<TrackMapOptions>> {
  onTrackColorChanged = (trackColor: string) => {
    this.props.onOptionsChange({...this.props.options, trackColor})
  }

  onPointColorChanged = (pointColor: string) => {
    this.props.onOptionsChange({...this.props.options, pointColor})
  }

  render() {
    const { options } = this.props;

    return (
      <div className="section gf-form-group">
        <h5 className="section-heading">Trackmap properties</h5>
        <div className="gf-form">
        <FormLabel width={6}>Track color</FormLabel>
        <ColorPicker color={options.trackColor} onChange={this.onTrackColorChanged}/>
        <FormLabel width={12}>"Current" trackpoint color</FormLabel>
        <ColorPicker color={options.pointColor} onChange={this.onPointColorChanged}/>
        </div>
      </div>
    );
  }
}
