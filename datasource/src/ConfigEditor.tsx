import { LegacyForms } from '@grafana/ui';
const { FormField, Switch } = LegacyForms;

import React, { PureComponent, ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { SignalKDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<SignalKDataSourceOptions> {}

interface State {}

export class ConfigEditor extends PureComponent<Props, State> {
  onHostnameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      hostname: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onSSLChange = (event: any) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      ssl: !!event.target.checked,
    };
    onOptionsChange({ ...options, jsonData });
  }


  render() {
    const { options } = this.props;
    const { jsonData } = options;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <Switch
            label='SSL'
            onChange={this.onSSLChange}
            checked={!!jsonData.ssl}
          />
          <FormField
            label="Server address"
            labelWidth={10}
            inputWidth={20}
            onChange={this.onHostnameChange}
            value={jsonData.hostname || ''}
            placeholder="Signal K server hostname/ip address"
          />
        </div>
      </div>
    );
  }
}
