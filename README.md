# Signal K Grafana Datasource

- [x] add server hostname to datasource config
- [x] add path configuration to query editor
- [x] fetch path list from server
- [x] add simple multiplier for unit conversion
- [x] build Docker image
- [x] add reconnect
- [x] auto provision datasource & dashboard in Docker
- [x] check that the query is up to "now" to trigger streaming
- [x] implement history retrieval from server SK history api
- [x] dual data buffer handling (history & streaming)
- [x] implement history retrieval from server via InfluxDB/ClickHouse/SK history api?
- [x] implement min / max / avg aggregates for history
- [x] dangling ws connections
- [x] coordinate handling for navigation.position
- [ ] coordinate querying if targets have different contexts
- [ ] default to `self`
- [ ] move trackmap to the same repo
- [ ] CH: implement different aggregates as multiple UNION ALL queries
- [ ] allow only-streaming and only-history datasources
- [ ] default multiplier should be 1 and can not be missing
- [ ] implement min / max / avg / median aggregates for streaming data
- [ ] use subscriptions
- [ ] add context configuration to query editor (history api, self handling)
- [ ] add proper unit conversion
- [ ] add server port to datasource config
- [ ] investigate proxying via Grafana server
- [ ] add SSL toggle to datasource config
- [ ] authentication support & testing
- [ ] add 'self' handling for history
- [ ] add name to context handling
- [ ] add option to turn off streaming (you can always query now-1s, maybe not necessary?)
- [ ] https://github.com/grafana/grafana/issues/21264
- [ ] keep data in memory? so that timespan changes do not clear the graph (not relevant with history fetching)
- [ ] test backend separately for streaming & history capabilities
- [ ] query backend for single vessel /  multiple and show/hide context selection accordingly
- [ ] dashboard level context selection
- [ ] geocoded data support for map/track display

# Developing

- `yarn watch` runs concurrently the TS build and Grafana in a container with the plugin mounted and a provisioned dashboard with data from demo.signalk.org: [localhost:3002](http://localhost:3002) credentials are admin/secret
- https://github.com/tkurki/signalk-to-influxdb/pull/34 has an implementation of the history api, needs https://github.com/SignalK/signalk-server-node/pull/935, add a new Datasource in Grafana that points to your SK server and make it default so that the auto-provisioned dashboard will start using it
- 

