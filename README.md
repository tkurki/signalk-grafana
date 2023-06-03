# Signal K Datasource and Trackmap plugin for Grafana

This repo contains
- **Grafana Datasource** that can **stream** real time data from a Signal K server and retrieve historical data via work in progress Signal K **history API**
- **Trackmap plugin** that can draw own vessel track from data retrieved via Signal K history API
- Dockerfile for a Grafana image that includes the datasource and plugin

![image](https://user-images.githubusercontent.com/1049678/129489818-50c711a8-599b-4322-8971-7eb014f1d818.png)

The quickes way to try it out is to launch a prebuilt image from Docker Hub:

`docker run -d -p 3002:3000 -e GF_AUTH_ANONYMOUS_ENABLED=true -e GF_AUTH_ANONYMOUS_ORG_ROLE=Admin tkurki/signalk-grafana:master`

>Note that this will run Grafana with anonymous admin access

Then
- add a Signal K data source for `demo.signalk.org` as default
- add a Dashboard and Panel with the default `self` context and `navigation.speedOverGround`
- change the time range to _Last 5 minutes_ so that the streaming updates are clearly visible

demo.signalk.org does not support the history API, so you get only streaming updates and the history is not retained over dashboard reloads. 

[InfluxDb plugin](https://github.com/tkurki/signalk-to-influxdb) implements the history API so the easiest way to try also history is to run a local Signal K server with some data the updates and InfluxDb plugin enabled. That should give you both access to historical data *and* streaming updates when you select a timerange up to _now_ (_last X minutes_ etc).

## Details

The plugins are so far unsigned and unpublished, so you need to tell Grafana that you want to run them anyway with `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=signalk-datasource,signalk-trackmap`.

The datasource runs in your browser, so you can use the same hostname that you use to access your SK server as the hostname in the datasource configuration.

## Missing functionality

- authentication support
- accessing the datasource via Grafana server

