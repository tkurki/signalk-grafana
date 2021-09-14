import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import defaults from 'lodash/defaults';

import React, { PureComponent, ChangeEvent } from 'react';
import { QueryEditorProps, SelectableValue, DataQueryRequest, TimeRange } from '@grafana/data';
import { DataSource, QueryListener } from './DataSource';
import { SignalKDataSourceOptions, defaultQuery, SignalKQuery } from './types';

type Props = QueryEditorProps<DataSource, SignalKQuery, SignalKDataSourceOptions>;

interface State {
  paths: Array<SelectableValue<string>>;
  contexts: Array<SelectableValue<string>>;
  context: string;
}

interface AggregateFunctionValue {
  label: string;
  value: string;
}

interface PathWithMeta {
  path: string,
  meta: object
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
      console.log('fetching')
      fetchContexts(this.props.datasource.hostname, options).then((contexts) => {
        contexts.unshift({
          value: 'vessels.self',
          label: 'self',
        });
        this.setState({ contexts });
      });
      fetchPaths(this.props.datasource.hostname, options, this.state?.context)
        .then((paths) => this.setState({ paths }));
    },
  };
  componentDidMount() {
    this.props.datasource.addListener(this.queryListener);
  }
  componentWillUnmount() {
    this.props.datasource.removeListener(this.queryListener);
  }

  onContextChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    const context = item && item.value ? item.value : ''
    onChange({ ...query, context });
    this.setState({ context })
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
    const pathLabels = this.state && this.state.paths ? this.state.paths.map(({path}) => path).map(toLabelValue) : []

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
              options={pathLabels}
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

const fetchPaths = (hostname: string, options: DataQueryRequest<SignalKQuery>, context: string): Promise<Array<PathWithMeta>> => {
  return fetch(getPathsUrl(hostname, options.range, context), {
    credentials: 'include',
  })
    .then((res) => res.json())
    .then((paths: string[]) => {
      const validPathPromises: Array<Promise<PathWithMeta | void>> = paths.map((path) => {
        const metaPath = `http://${hostname}/signalk/v1/api/vessels/self/${path.split('.').join('/')}/meta`;
        return fetch(metaPath, {
          credentials: 'include',
        })
          .then((res) =>
            res.status === 200
              ? res
                .json()
                .then((meta) => ({path, meta}))
                .catch((err) => {console.log(err); return Promise.resolve(undefined)})
              : Promise.resolve({path, meta: {}})
          )
          .catch((err) => {
            console.log(err);
            return Promise.resolve(undefined);
          });
      });
      return Promise.all(validPathPromises).then(
        (pathOrUndefinedA: Array<PathWithMeta | void>): PathWithMeta[] => pathOrUndefinedA.flatMap(f => !!f ? [f] : [])
      );
    })
    .catch((err) => {
      console.log(err)
      return []
    });
};

const getPathsUrl = (hostname: string, range?: TimeRange, context?: string) => {
  if (!range) {
    throw new Error('Valid range required for fetching paths');
  }
  const queryParams: { [k: string]: string } = { from: range.from.toISOString(), to: range.to.toISOString() };
  if (context) {
    queryParams.context = context
  }
  const url: URL = new URL(`http://${hostname}/signalk/v1/history/paths`);
  Object.keys(queryParams).forEach((key) => url.searchParams.append(key, queryParams[key]));
  return url.toString();
}

const fetchContexts = (hostname: string, options: DataQueryRequest<SignalKQuery>) =>
  fetch(getContextsUrl(hostname, options.range || undefined), {
    credentials: 'include',
  })
    .then((res) => res.json())
    .then((contexts) => contexts.map(toLabelValue));

const getContextsUrl = (hostname: string, range?: TimeRange) => {
  if (!range) {
    throw new Error('Valid range required for fetching contexts');
  }
  const queryParams: { [k: string]: string } = { from: range.from.toISOString(), to: range.to.toISOString() };
  const url: URL = new URL(`http://${hostname}/signalk/v1/history/contexts`);
  Object.keys(queryParams).forEach((key) => url.searchParams.append(key, queryParams[key]));
  return url.toString();
};

const toLabelValue = (s:string) => ({ label: s, value: s })
