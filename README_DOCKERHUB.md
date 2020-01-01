# Grafana with Signal K Datasource

This Docker image [adds](https://github.com/tkurki/signalk-grafana-datasource/blob/master/Dockerfile) a preinstalled [Signal K streaming datasource](https://github.com/tkurki/signalk-grafana-datasource) to the official [Grafana image](https://hub.docker.com/r/grafana/grafana).

The image has a preconfigured datasource for demo.signalk.org including a demonstration dashboard.

Example invocation:

```
docker run -p 3001:3000 -e "GF_SECURITY_ADMIN_PASSWORD=secret" --name=signalk-grafana tkurki/grafana-signalk
```

Grafana should be then accessible at [http://localhost:3001](http://localhost:3001)


