import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './DataSource';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';
import { SignalKQuery, SignalKDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, SignalKQuery, SignalKDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
