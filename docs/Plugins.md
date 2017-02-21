# Plugins

Microwork provides basic support for plugins.
Following plugins are currently available:

## Hardware stats plugin

Provides basic hardware stats about node (currently includes cpu with average load and memory information).

Example usage:
```js
const HardwareStat = require('microwork/lib/plugins/hardwarestat');

// create service
const service = new Microwork({host: 'docker.dev', exchange});
// register plugin
service.registerPlugin(HardwareStat);
// hardware autoreport interval, defaults to 60s
service.hardwareReportInterval = 60000;
// start autoreport
service.autoreportHardwareStats();
```

To listen to the stats you need to tap into `microwork.node.status` topic, like so:
```js
await service.subscribe('microwork.node.status', (stats) => {
  console.log(stats); // <- stats object
  /* e.g.:
  {
    "cpu": {
      "cpus": 8, // count
      "load": [1.1962890625,1.35107421875,1.34912109375] // avg load in last 1m, 5m, 15m
    },
    "mem": { // in bytes
      "used": 15742152704,
      "free": 1437716480,
      "total": 17179869184
    }
  }
    */
});
```

## Health plugin

Provides basic keep-alive signal from node.

Example usage:
```js
const HealthCheck = require('microwork/lib/plugins/healthcheck');

// create service
const service = new Microwork({host: 'docker.dev', exchange});
// register plugin
service.registerPlugin(HealthCheck);
// report interval in ms, defaults to 30s
service.healthchecksReportInterval = 30000;
// start autoreport
service.autoreportHealth();
```

To listen to the keep-alive signals you need to tap into `microwork.node.alive` topic, like so:
```js
await service.subscribe('microwork.node.alive', (id) => {
  console.log(id); // <- live node id
});
```

## Subscribers info plugin

Provides basic info about subscribers from node.

Example usage:
```js
const SubscriberStats = require('microwork/lib/plugins/substats');

// create service
const service = new Microwork({host: 'docker.dev', exchange});
// register plugin
service.registerPlugin(SubscriberStats);
// init subs reporting
service.initSubscribersReporting();
```

To retrieve the subscribers you need to tap into `microwork.node.subscribers` topic and then send an empty message to `microwork.node.report.subscribers` topic, like so:
```js
await service.subscribe('microwork.node.subscribers', (info) => {
  console.log(info); // <- node info including ID and array of subscribed topics
  /* e.g.
  { id: '3a4a5bd0-9c58-4677-b89b-9e5107da265f',
    subscribers:
      [ { topic: 'test.sub', subscribers: 1 },
        { topic: 'test.other.sub', subscribers: 2 },
        { topic: 'microwork.node.subscribers', subscribers: 1 },
        { topic: 'microwork.node.report.subscribers', subscribers: 1 } ] }
  */
});

await service.send('microwork.node.report.subscribers');
```
