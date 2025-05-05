#!/bin/bash

if [ ! -d "node_modules/signalk-to-influxdb2" ]; then
    npm install --save signalk-to-influxdb2
fi

/usr/lib/node_modules/signalk-server/bin/signalk-server --sample-n2k-data