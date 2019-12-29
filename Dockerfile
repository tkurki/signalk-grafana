FROM grafana/grafana:6.5.2
COPY dist /var/lib/grafana/plugins/sk-datasource/dist
COPY datasource.yml /etc/grafana/provisioning/datasources
COPY dashboards /etc/grafana/provisioning/dashboards