import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { UnitConversion } from 'conversions';

export interface SignalKQuery extends DataQuery {
  context: string;
  path: string;
  multiplier: number;
  unitConversion?: UnitConversion;
  aggregate: string;
  dollarsource?: string;
}

/**
 * These are options configured for each DataSource instance
 */
export interface SignalKDataSourceOptions extends DataSourceJsonData {
  hostname?: string;
  ssl?: boolean;
  useAuth: boolean;
}

export interface SecureSignalKDataSourceOptions {
  token?: string
}
