import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface SignalKQuery extends DataQuery {
  path: string;
  multiplier: number
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

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
