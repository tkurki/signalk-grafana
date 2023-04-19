FROM grafana/grafana:9.4.7

ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=signalk-datasource,signalk-trackmap

COPY datasource/dist /var/lib/grafana/plugins/sk-datasource
COPY trackmap/dist /var/lib/grafana/plugins/trackmap
