# Grafana Track Map Panel Plugin

Grafana Map Panel that can display tracks from a Signal K Datasource. 

Specify `navigation.position` as the Signal K path in the datasource configuration.

# Todo

- [x] fetch and plot coordinates
- [x] discard outliers
- [ ] Grafana cursor support
- [ ] disable streaming updates? probably will cause havoc
- [ ] panel resize support
- [ ] zoom in by clicking and dragging
- [ ] streaming support
- [ ] data overlay support a k a "colored dots on the track"
- [ ] chart configuration support
- [ ] outlier discard configuration (maybe on/off at least)

# Development

First, install dependencies:
```
yarn install
```

To work with this plugin run:
```
yarn dev
```

or
```
yarn watch
```

This will run linting tools and apply prettier fix.


To build the plugin run:
```
yarn build
```
