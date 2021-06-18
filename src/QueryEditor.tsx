import defaults from 'lodash/defaults';

import React, { PureComponent, ChangeEvent } from 'react';
import { Select, InlineFormLabel, LegacyForms } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './DataSource';
import { SignalKDataSourceOptions, defaultQuery, SignalKQuery } from './types';

type Props = QueryEditorProps<DataSource, SignalKQuery, SignalKDataSourceOptions>;

interface State {
  options: Array<SelectableValue<string>>;
}

export class QueryEditor extends PureComponent<Props, State> {
  componentDidMount() {
    getPathOptions(this.props.datasource.hostname).then((options) => this.setState({ options }));
  }

  onPathChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, path: item && item.value ? item.value : '' });
    onRunQuery(); // executes the query
  };

  onMultiplierChange = (item: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, multiplier: Number.parseFloat(item.target.value) || 1 });
    onRunQuery(); // executes the query
  };

  onDollarsourceChange = (item: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, dollarsource: item.target.value });
    onRunQuery(); // executes the query
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { path, multiplier, dollarsource } = query;

    return (
      <div className="gf-form">
        <InlineFormLabel width={7}>Signal K Path</InlineFormLabel>
        <Select
          value={{ label: path, value: path }}
          options={this.state ? this.state.options : []}
          allowCustomValue={true}
          backspaceRemovesValue={true}
          isClearable={true}
          onChange={this.onPathChange}
          noOptionsMessage={'Path list not available'}
        />
        <LegacyForms.FormField
          label="$source"
          // labelWidth={5}
          // inputWidth={12}
          onChange={this.onDollarsourceChange}
          value={dollarsource || ''}
          placeholder="Blank = no source filter"
        />

        <LegacyForms.FormField
          label="Multiply by"
          labelWidth={8}
          value={multiplier}
          width={8}
          type="number"
          tooltip="Use for converting units"
          onChange={this.onMultiplierChange}
        />
      </div>
    );
  }
}

const getPathOptions = (hostname: string): Promise<Array<SelectableValue<string>>> => {
  return fetch(`http://${hostname}/signalk/v1/flat/self/keys`)
    .then((res) => res.json())
    .then((paths: string[]) => {
      const validPathPromises: Array<Promise<string | void>> = paths.map((path) => {
        const metaPath = `http://${hostname}/signalk/v1/api/vessels/self/${path.split('.').join('/')}/meta`;
        return fetch(metaPath)
          .then((res) =>
            res.status === 200
              ? res
                  .json()
                  .then((meta) => (meta.units ? Promise.resolve(path) : Promise.resolve(undefined)))
                  .catch((err) => Promise.resolve(undefined))
              : Promise.resolve(undefined)
          )
          .catch((err) => {
            console.log(err);
            return Promise.resolve(undefined);
          });
      });
      return Promise.all(validPathPromises).then(
        (pathOrUndefinedA: Array<string | void>): string[] => pathOrUndefinedA.filter((p) => p) as string[]
      );
    })
    .then((paths: string[]) => {
      return paths.map((path) => ({ label: path, value: path }));
    })
    .catch(() => []);
};
