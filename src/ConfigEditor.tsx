import React, { PureComponent, ChangeEvent } from 'react';
import { FormField } from '@grafana/ui';
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

  // Secure field (only sent to th ebackend)
  onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonData: {
        apiKey: event.target.value,
      },
    });
  };

  onResetAPIKey = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        apiKey: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        apiKey: '',
      },
    });
  };

  render() {
    const { options } = this.props;
    const { jsonData } = options;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
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
