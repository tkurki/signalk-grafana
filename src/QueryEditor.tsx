import defaults from 'lodash/defaults';

import React, { PureComponent, ChangeEvent } from 'react';
import { Select, FormLabel, FormField } from '@grafana/ui';
import { QueryEditorProps, SelectableValue, DataQueryRequest, TimeRange } from '@grafana/data';
import { DataSource, QueryListener } from './DataSource';
import { SignalKDataSourceOptions, defaultQuery, SignalKQuery } from './types';

type Props = QueryEditorProps<DataSource, SignalKQuery, SignalKDataSourceOptions>;

interface State {
  paths: Array<SelectableValue<string>>;
  contexts: Array<SelectableValue<string>>;
}

export class QueryEditor extends PureComponent<Props, State> {
  queryListener: QueryListener = {
    onQuery: (options: DataQueryRequest<SignalKQuery>) => {
      fetchContexts(options).then(contexts => this.setState({ contexts }));
    },
  };
  componentDidMount() {
    getPathOptions(this.props.datasource.hostname).then(paths => this.setState({ paths }));
    this.props.datasource.addListener(this.queryListener);
  }
  componentWillUnmount() {
    this.props.datasource.removeListener(this.queryListener);
  }

  onContextChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, context: item && item.value ? item.value : '' });
    onRunQuery();
  };

  onPathChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, path: item && item.value ? item.value : '' });
    onRunQuery();
  };

  onMultiplierChange = (item: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, multiplier: Number.parseFloat(item.target.value) || 1 });
    onRunQuery();
  };

  onDollarsourceChange = (item: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, dollarsource: item.target.value });
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { path, multiplier, dollarsource, context } = query;

    return (
      <div className="gf-form">
        <FormLabel width={7}>Context</FormLabel>
        <Select
          value={{ label: context, value: context }}
          options={this.state ? this.state.contexts : []}
          allowCustomValue={true}
          backspaceRemovesValue={true}
          isClearable={true}
          onChange={this.onContextChange}
          noOptionsMessage={() => 'Context list not available'}
        />
        <FormLabel width={7}>Signal K Path</FormLabel>
        <Select
          value={{ label: path, value: path }}
          options={this.state ? this.state.paths : []}
          allowCustomValue={true}
          backspaceRemovesValue={true}
          isClearable={true}
          onChange={this.onPathChange}
          noOptionsMessage={() => 'Path list not available'}
        />
        <FormField
          label="$source"
          labelWidth={5}
          inputWidth={12}
          onChange={this.onDollarsourceChange}
          value={dollarsource || ''}
          placeholder="Blank = no source filter"
        />

        <FormField
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
    .then(res => res.json())
    .then((paths: string[]) => {
      const validPathPromises: Array<Promise<string | void>> = paths.map(path => {
        const metaPath = `http://${hostname}/signalk/v1/api/vessels/self/${path.split('.').join('/')}/meta`;
        return fetch(metaPath)
          .then(res =>
            res.status === 200
              ? res
                  .json()
                  .then(meta => (meta.units ? Promise.resolve(path) : Promise.resolve(undefined)))
                  .catch(err => Promise.resolve(undefined))
              : Promise.resolve(undefined)
          )
          .catch(err => {
            console.log(err);
            return Promise.resolve(undefined);
          });
      });
      return Promise.all(validPathPromises).then((pathOrUndefinedA: Array<string | void>): string[] => pathOrUndefinedA.filter(p => p) as string[]);
    })
    .then(toLabelValues)
    .catch(() => []);
};

const fetchContexts = (options: DataQueryRequest<SignalKQuery>) =>
  fetch(getContextsUrl(options.range), {
    mode: 'cors',
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  })
    .then(res => res.json())
    .then(toLabelValues);

const getContextsUrl = (range: TimeRange) => {
  const queryParams: { [k: string]: string } = { from: range.from.toISOString(), to: range.to.toISOString() };
  const url: URL = new URL(`http://localhost:3000/signalk/v1/history/contexts`);
  Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
  return url.toString();
};

const toLabelValues = (values: string[]) => values.map(s => ({ label: s, value: s }));
