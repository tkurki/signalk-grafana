import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface SignalKQuery extends DataQuery {
  path: string;
  multiplier: number;
  dollarsource?: string;
}

export const defaultQuery: Partial<SignalKQuery> = {
  path: 'navigation.speedOverGround',
};

/**
 * These are options configured for each DataSource instance
 */
export interface SignalKDataSourceOptions extends DataSourceJsonData {
  hostname?: string;
}
