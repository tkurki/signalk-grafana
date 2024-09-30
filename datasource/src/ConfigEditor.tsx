import { LegacyForms } from '@grafana/ui';
const { FormField, Switch } = LegacyForms;

import React, { PureComponent, ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { SecureSignalKDataSourceOptions, SignalKDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<SignalKDataSourceOptions, SecureSignalKDataSourceOptions> {}

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

  onTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonData: {
        token: event.target.value,
      },
    });
  };

  onUseAuthChange = (event: any) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      useAuth: !!event.target.checked,
    };
    onOptionsChange({ ...options, jsonData });
  }


  render() {
    const { options } = this.props;
    const { jsonData, secureJsonData } = options;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <Switch
            label='SSL'
            onChange={this.onSSLChange}
            checked={!!jsonData.ssl}
          />
          <FormField
            label="Server host:port"
            labelWidth={10}
            inputWidth={20}
            onChange={this.onHostnameChange}
            value={jsonData.hostname || ''}
            placeholder="Signal K server hostname/ip address"
          />
          <Switch
            label='Use Authentication'
            onChange={this.onUseAuthChange}
            checked={!!jsonData.useAuth}
          />
          <FormField
            label="Authentication Token"
            labelWidth={10}
            inputWidth={20}
            onChange={this.onTokenChange}
            value={secureJsonData?.token ?? ''}
            placeholder="Access token"
          />
        </div>
      </div>
    );
  }
}
