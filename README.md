# Signal K Grafana Datasource

- [x] add server hostname to datasource config
- [x] add path configuration to query editor
- [ ] fetch path list from server
- [ ] add server port to datasource config
- [ ] add SSL toggle to datasource config
- [ ] authentication support & testing
- [ ] investigate proxying via Grafana server
- [ ] add context configuration to query editor
- [ ] add reconnect?
- [ ] check that the query is up to "now" to trigger streaming
- [ ] use subscriptions
- [ ] keep data in memory? so that timespan changes do not clear the graph
- [ ] implement history retrieval from server via InfluxDB/ClickHouse/SK history api?
