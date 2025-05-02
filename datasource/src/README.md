# SignalK-Datasource

![Dynamic JSON Badge](https://img.shields.io/badge/dynamic/json?logo=grafana&query=$.version&url=https://grafana.com/api/plugins/signalk-datasource&label=Marketplace&prefix=v&color=F47A20)
![License](https://img.shields.io/github/license/tkurki/signalk-grafana)

## Overview 

This is a datasource for using Signal K data over
- streaming WebSocket connection for realtime data
- the History HTTP API

For streaming data you will need a Signal K server providing access to the data. To test the functionality you can connect to https://demo.signalk.org. Streaming data opens a connection to the Signal K server that update as new data is received when you have Grafana open. With just streaming data you can have an updating dashboard, but you can not scroll back in time and all updates happening when the Grafana window is not active won't be shown.

For access to history data you will need a database where the data is stored and access to the data via Signal K server. This is provided by the [signalk-to-influxdb2 plugin](https://github.com/tkurki/signalk-to-influxdb2). The plugin stores the data in an InfluxDb v2 database and implements a History API that the datasource accesses.

Streaming WebSocket data and History API work transparently together so that when you open Grafana with timespan set relative to "now" the datasource will fill the data for the chosen time span from the History API and start streaming real time updates as they are received.

The main benefits of using this datasource over connecting directly to a database are:
- no need to understand how to query the database - instead you can just pick Signal K paths and sources to choose the data you want
- the datasource is aware of the Signal schema and metadata: it knows what each path's unit is and provides out of the box conversions to other units
- it provides full access to your data, combining the realtime updates with full access to history

![SignalK Datasource Screenshot](https://github.com/user-attachments/assets/155f2cd6-ff20-429d-b841-bdc187acbeff)

![SignalK Datasource Graph Configuration Path picking](https://github.com/user-attachments/assets/23018162-33b5-400a-9c6a-ec1eee0d6b6f)

![SignalK Datasource Graph Configuration](https://github.com/user-attachments/assets/ba3ad93c-07e7-49e5-b8d4-898326f6f07f)

![SignalK Datasource Conversion Configuration](https://github.com/user-attachments/assets/f1463e0a-484e-4ad2-9354-4f49fcab222e)
