# Grafana with Signal K Datasource

This Docker image extends the official grafana/grafana image by [adding](https://github.com/tkurki/signalk-grafana/blob/master/Dockerfile) the following unsigned plugins:
- **Grafana Datasource** that can **stream** real time data from a Signal K server and retrieve historical data via work in progress Signal K **history API**
- **Trackmap plugin** that can draw own vessel track from data retrieved via Signal K history API

![image](https://user-images.githubusercontent.com/1049678/129489818-50c711a8-599b-4322-8971-7eb014f1d818.png)

Quick start:
`docker run -d -p 3002:3000 -e GF_AUTH_ANONYMOUS_ENABLED=true -e GF_AUTH_ANONYMOUS_ORG_ROLE=Admin tkurki/signalk-grafana:master`

>Note that this will run Grafana with anonymous admin access

