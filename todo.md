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
- [x] default multiplier should be 1 and can not be missing
- [x] default to `self`
- [x] show shared tooltip on the map
- [x] shift drag to zoom in map to set timerange
- [x] move trackmap to the same repo
- [x] check that there is no hardcoded host or port
- [x] panel resize support
- [ ] influx: even minutes need  seconds in from-to in influx query
- [ ] configurable track & "now" marker color
- [ ] visualise data with colored dot & secondary ring (D3 color mapping)
- [ ] show tooltip on graph from position on map
- [ ] editable map layers
- [ ] map layers from sk server
- [ ] use full `vessels.xx` as context
- [ ] fix querying if targets have different contexts
- [ ] CH: implement different aggregates as multiple UNION ALL queries
- [ ] allow only-streaming and only-history datasources
- [ ] implement min / max / avg / median aggregates for streaming data
- [ ] use subscriptions
- [ ] add context configuration to query editor (history api, self handling)
- [ ] add proper unit conversion
- [ ] add server port to datasource config
- [ ] investigate proxying via Grafana server
- [ ] add SSL toggle to datasource config
- [ ] authentication support
- [ ] add 'self' handling for history
- [ ] add name to context handling, show MMSI:Name in the popup
- [ ] add option to turn off streaming (you can always query now-1s, maybe not necessary?)
- [ ] pause streaming when dragging on graph? https://github.com/grafana/grafana/issues/21264
- [ ] keep data in memory? so that timespan changes do not clear the graph (not relevant with history fetching)
- [ ] test backend separately for streaming & history capabilities
- [ ] query backend for single vessel /  multiple and show/hide context selection accordingly
- [ ] dashboard level context selection
- [ ] disable streaming updates in map? probably will cause havoc
- [ ] outlier discard configuration (maybe on/off at least), buffer length to control how many outliers are tolerated
- [ ] influx: fetch availables paths