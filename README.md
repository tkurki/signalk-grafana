# Developing

- `yarn watch` runs concurrently the TS builds and Grafana in a container with the plugin mounted and a provisioned dashboard with data from demo.signalk.org: [localhost:3002](http://localhost:3002) credentials are admin/secret
- https://github.com/tkurki/signalk-to-influxdb/pull/34 has an implementation of the history api, needs https://github.com/SignalK/signalk-server-node/pull/935, add a new Datasource in Grafana that points to your SK server and make it default so that the auto-provisioned dashboard will start using it

