# Developing

- `yarn watch` runs concurrently the TS builds and Grafana in a container with the datasource and trackmap plugins mounted and a provisioned dashboard with data from localhost: [localhost:3002](http://localhost:3002) with access control disabled
- https://github.com/tkurki/signalk-to-influxdb/pull/34 has an implementation of the history api, needs https://github.com/SignalK/signalk-server-node/pull/935, add a new Datasource in Grafana that points to your SK server and make it default so that the auto-provisioned dashboard will start using it

