import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import defaults from 'lodash/defaults';

import React, { PureComponent, ChangeEvent } from 'react';
import { Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue, DataQueryRequest, TimeRange } from '@grafana/data';
import { DataSource, QueryListener } from './DataSource';
import { SignalKDataSourceOptions, defaultQuery, SignalKQuery } from './types';

type Props = QueryEditorProps<DataSource, SignalKQuery, SignalKDataSourceOptions>;

interface State {
  paths: Array<SelectableValue<string>>;
  contexts: Array<SelectableValue<string>>;
}

interface AggregateFunctionValue {
  label: string;
  value: string;
}

type AggregateFunctionValueMap = { [key: string]: AggregateFunctionValue };

const aggregateFunctionData = [
  { label: 'Average', value: 'average' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
];
const aggregateFunctions: AggregateFunctionValueMap = aggregateFunctionData.reduce(
  (acc: { [key: string]: AggregateFunctionValue }, a: AggregateFunctionValue) => {
    acc[a.value] = a;
    return acc;
  },
  {}
);

export class QueryEditor extends PureComponent<Props, State> {
  queryListener: QueryListener = {
    onQuery: (options: DataQueryRequest<SignalKQuery>) => {
      fetchContexts(options).then(contexts => {
        contexts.unshift({
          value: 'vessels.self',
          label: 'self',
        });
        this.setState({ contexts });
      });
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
    let multiplier = Number.parseFloat(item.target.value);
    if (typeof multiplier === 'undefined') {
      multiplier = 1;
    }
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, multiplier });
    onRunQuery();
  };

  onDollarsourceChange = (item: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, dollarsource: item.target.value });
    onRunQuery();
  };

  onAggregateChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, aggregate: item.value || 'average' });
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { path, multiplier, dollarsource, context, aggregate } = query;

    return (
      <div>
        <InlineFieldRow>
          <InlineField labelWidth={14} label="Context">
            <Select
              value={{ label: context || 'self', value: context || 'vessels.self' }}
              options={this.state ? this.state.contexts : []}
              allowCustomValue={true}
              backspaceRemovesValue={true}
              isClearable={true}
              onChange={this.onContextChange}
              noOptionsMessage={'Context list not available'}
              width={40}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField labelWidth={14} label="Path">
            <Select
              value={{ label: path, value: path }}
              options={this.state ? this.state.paths : []}
              allowCustomValue={true}
              backspaceRemovesValue={true}
              isClearable={true}
              onChange={this.onPathChange}
              noOptionsMessage={'Path list not available'}
              width={80}
            />
          </InlineField>
          <InlineField labelWidth={14} label="$source">
            <Input
              css={''}
              width={12}
              name={'$source'}
              id={'$source'}
              onChange={this.onDollarsourceChange}
              value={dollarsource || ''}
              placeholder="Blank = no source filter"
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField labelWidth={14} label="Aggregate">
            <Select
              value={aggregateFunctions[aggregate || 'average']}
              options={aggregateFunctionData}
              allowCustomValue={false}
              backspaceRemovesValue={false}
              isClearable={true}
              onChange={this.onAggregateChange}
              width={20}
            />
          </InlineField>
          <InlineField labelWidth={14} label="Multiply by">
            <Input
              css={''}
              label="Multiply by"
              value={typeof multiplier === 'number' ? multiplier : 1}
              width={20}
              type="number"
              onChange={this.onMultiplierChange}
            />
          </InlineField>
        </InlineFieldRow>
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
                  .catch(() => Promise.resolve(undefined))
              : Promise.resolve(undefined)
          )
          .catch(err => {
            console.log(err);
            return Promise.resolve(undefined);
          });
      });
      return Promise.all(validPathPromises).then(
        (pathOrUndefinedA: Array<string | void>): string[] => pathOrUndefinedA.filter(p => p) as string[]
      );
    })
    .then(toLabelValues)
    .catch(() => []);
};

const fetchContexts = (options: DataQueryRequest<SignalKQuery>) =>
  fetch(getContextsUrl(options.range || undefined), {
    mode: 'cors',
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  })
    .then(res => res.json())
    .then(toLabelValues);

const getContextsUrl = (range?: TimeRange) => {
  if (!range) {
    throw new Error('Valid range required for fetching contexts');
  }
  const queryParams: { [k: string]: string } = { from: range.from.toISOString(), to: range.to.toISOString() };
  const url: URL = new URL(`http://localhost:3000/signalk/v1/history/contexts`);
  Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
  return url.toString();
};

const toLabelValues = (values: string[]) => values.map(s => ({ label: s, value: s }));
