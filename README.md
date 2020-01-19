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
- [x] add context configuration to query editor (history api)
- [x] dual data buffer handling (history & streaming)
- [ ] add proper unit conversion
- [ ] add server port to datasource config
- [ ] add SSL toggle to datasource config
- [ ] authentication support & testing
- [ ] investigate proxying via Grafana server
- [ ] add 'self' handling for history
- [ ] add name to context handling
- [ ] add option to turn off streaming
- [ ] use subscriptions
- [ ] keep data in memory? so that timespan changes do not clear the graph
- [ ] implement history retrieval from server via InfluxDB/ClickHouse/SK history api?
- [ ] implement min / max / avg / median aggregates for history
- [ ] query backend for single vessel /  multiple
- [ ] dashboard level context selection

# Developing

- `yarn watch` runs concurrently the TS build and Grafana in a container with the plugin mounted and a provisioined dashboard with data from demo.signalk.org: [localhost:3002](http://localhost:3002) admin/secret
