FROM grafana/grafana:8.0.3
COPY dist /var/lib/grafana/plugins/sk-datasource/dist
COPY datasource.yml /etc/grafana/provisioning/datasources
COPY dashboards /etc/grafana/provisioning/dashboards