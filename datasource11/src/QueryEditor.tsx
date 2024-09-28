import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import defaults from 'lodash/defaults';

import React, { PureComponent, ChangeEvent } from 'react';
import { QueryEditorProps, SelectableValue, getDefaultTimeRange } from '@grafana/data';
import { DataSource, QueryListener, toLabelValue } from './DataSource';
import { SignalKDataSourceOptions, SignalKQuery } from './types';
import { Unit, UnitConversion, getTargetUnits } from 'conversions';

type Props = QueryEditorProps<DataSource, SignalKQuery, SignalKDataSourceOptions>;

interface State {
  paths: PathWithMeta[];
  contexts: Array<SelectableValue<string>>;
  context: string;
  conversions: Array<SelectableValue<UnitConversion>>;
  meta: {
    units?: string;
  };
}

interface AggregateFunctionValue {
  label: string;
  value: string;
}

export interface PathWithMeta {
  path: string;
  meta: () => Promise<{
    units?: string;
  }>;
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
    onQuery: () => this.fetchContextsAndPaths,
  };

  fetchContextsAndPaths() {
    this.props.datasource.fetchContexts(this.props.range || getDefaultTimeRange()).then((contexts) => {
      contexts.unshift({
        value: 'vessels.self',
        label: 'self',
      });
      this.setState({ contexts });
    });
    this.props.datasource
      .fetchPaths(this.props.range || getDefaultTimeRange(), this.state?.context)
      .then((paths) => this.setState({ paths }))
      .then(() => this.updateConversions());
  }

  componentDidMount() {
    this.fetchContextsAndPaths();
    this.props.datasource.addListener(this.queryListener);
  }
  componentWillUnmount() {
    this.props.datasource.removeListener(this.queryListener);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.query.path !== this.props.query.path) {
      this.updateConversions()
    }
  }

  updateConversions() {
    const pWm = (this.state?.paths || []).find((pWm) => pWm.path === this.props.query.path)
    if (pWm) {
      pWm.meta().then(meta => {
        this.setState({ meta, conversions: getUnitConversions((meta?.units || '') as unknown as Unit) })
      })
    } else {
      this.setState({ conversions: [] })
    }
  }

  onContextChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    const context = item && item.value ? item.value : '';
    onChange({ ...query, context });
    this.setState({ context });
    onRunQuery();
  };

  onPathChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    const path = item && item.value ? item.value : '';
    onChange({ ...query, path, unitConversion: undefined, multiplier: 1 });
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

  onConversionChange = (item: SelectableValue<UnitConversion>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, unitConversion: item?.value });
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query);
    const { path, multiplier, dollarsource, context, aggregate, unitConversion } = query;
    const pathLabels = this.state && this.state.paths ? this.state.paths.map(({ path }) => path).map(toLabelValue) : [];
    return (
      <div>
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
          <InlineField
            labelWidth={18}
            label={`Convert from ${this.state?.meta?.units || '-'} to `}
            disabled={!this.state?.meta?.units}
          >
            <Select<UnitConversion>
              value={
                unitConversion
                  ? { label: unitConversion.to, value: unitConversion }
                  : { label: '(No conversion)', value: undefined }
              }
              options={this.state?.conversions}
              allowCustomValue={false}
              backspaceRemovesValue={true}
              isClearable={true}
              onChange={this.onConversionChange}
              width={24}
            />
          </InlineField>
          <InlineField

            labelWidth={15}
            label="Multiply by"
            disabled={!!unitConversion}
            tooltip={!!unitConversion ? 'Disable unit conversion to enter custom multiplier' : undefined}
          >
            <Input
              label="Multiply by"
              value={!unitConversion ? (typeof multiplier === 'number' ? multiplier : 1) : ''}
              width={10}
              type="number"
              onChange={this.onMultiplierChange}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField labelWidth={14} label="Context">
            <Select
              value={{
                label: context === 'vessels.self' ? 'self' : context || 'self',
                value: context || 'vessels.self',
              }}
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
      </div>
    );
  }
}

const getUnitConversions = (from: Unit): Array<SelectableValue<UnitConversion>> => [
  ...getTargetUnits(from as Unit).map((u) => ({ label: u, value: { from: from, to: u } })),
  { label: '(No conversion)', value: undefined },
];
