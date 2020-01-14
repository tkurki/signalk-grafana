# Signal K Grafana Datasource

- [x] add server hostname to datasource config
- [x] add path configuration to query editor
- [x] fetch path list from server
- [x] add simple multiplier for unit conversion
- [x] build Docker image
- [x] add reconnect
- [x] auto provision datasource & dashboard in Docker
- [ ] add proper unit conversion
- [ ] add server port to datasource config
- [ ] add SSL toggle to datasource config
- [ ] authentication support & testing
- [ ] investigate proxying via Grafana server
- [ ] add context configuration to query editor
- [ ] check that the query is up to "now" to trigger streaming
- [ ] use subscriptions
- [ ] keep data in memory? so that timespan changes do not clear the graph
- [ ] implement history retrieval from server via InfluxDB/ClickHouse/SK history api?


# Developing

- `yarn watch` runs concurrently the TS build and Grafana in a container with the plugin mounted and a provisioined dashboard with data from demo.signalk.org: [localhost:3002](http://localhost:3002) admin/secret