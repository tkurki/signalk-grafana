import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './DataSource';
import { SignalKDataSourceOptions, defaultQuery, SignalKQuery } from './types';

type Props = QueryEditorProps<DataSource, SignalKQuery, SignalKDataSourceOptions>;

interface State {
  options: SelectableValue<string>[];
}

export class QueryEditor extends PureComponent<Props, State> {
  componentDidMount() {
    getPathOptions(this.props.datasource.hostname).then(options => this.setState({ options }));
  }

  onPathChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, path: item.value || '' });
    onRunQuery(); // executes the query
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { path } = query;

    return (
      <div className="gf-form">
        <Select
          value={{ label: path, value: path }}
          options={this.state ? this.state.options : []}
          allowCustomValue={true}
          backspaceRemovesValue={true}
          onChange={this.onPathChange}
        />
      </div>
    );
  }
}

const getPathOptions = (hostname: string): Promise<SelectableValue<string>[]> => {
  return fetch(`http://${hostname}/signalk/v1/flat/self/keys`)
    .then(res => res.json())
    .then((paths: string[]) => {
      return paths.map(path => ({ label: path, value: path }));
    });
};
