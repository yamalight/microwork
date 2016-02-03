Microwork.js
=========================

[![npm](https://img.shields.io/npm/v/microwork.svg)](https://www.npmjs.com/package/microwork)
[![MIT](https://img.shields.io/npm/l/microwork.svg)](http://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/yamalight/microwork.svg?branch=master)](https://travis-ci.org/yamalight/microwork)
[![bitHound Overall Score](https://www.bithound.io/github/yamalight/microwork/badges/score.svg)](https://www.bithound.io/github/yamalight/microwork)
[![Coverage Status](https://coveralls.io/repos/github/yamalight/microwork/badge.svg?branch=master)](https://coveralls.io/github/yamalight/microwork?branch=master)
[![Code docs](https://img.shields.io/badge/code-docs-blue.svg)](http://yamalight.github.io/microwork/)

Microwork.js is a library for simple creation of distributed scalable microservices in node.js with RabbitMQ.

# Installation
```sh
npm install --save microwork
```

# Requirements

Since Microwork.js is written in ES6, it uses [babel](https://babeljs.io/) to compile the code before publishing. Currently we're using [es2015-node](https://github.com/rtsao/babel-preset-es2015-node) babel preset that only works in latest stable node (4.x or later).

# Features

* Simple interface for building distributed (micro)services
* Easy way to scale services both horizontally (by adding more nodes) and vertically (by adding more subscribers)
* Extensible with plugins

# Usage

## Quick start

Example service that subscribe to messages from `do.work` topic and does some work with incoming data (in this case it just appends ` world!` to incoming string):
```js
import Microwork from 'microwork';

// create task runner
const runner = new Microwork({host: 'your.rabbit.host', exchange: 'your.exchange'});
// add worker to specific topic
await runner.subscribe('do.work', (msg, reply) => {
    reply('response.topic', msg + ' world!');
});
// after work is done - cleanup
await runner.stop();
```

Example service that subscribes to messages from `response.topic` and logs them to console, as well as sends processing request to previously defined service:
```js
import Microwork from 'microwork';

// create master
const master = new Microwork({host: 'your.rabbit.host', exchange: 'your.exchange'});
// listen for reply from workers
await master.subscribe('response.topic', (msg) => {
    console.log(msg); // -> "hello world!"
});
// send message to workers
await master.send('do.work', 'hello');

// after work is done - cleanup
await master.stop();
```

## Using multiple subscribers to distribute tasks

Example service that adds two different subscribers to the same topic, they will be rotated by RabbitMQ using round-robin strategy (see [RabbitMQ tutorial 2](https://www.rabbitmq.com/tutorials/tutorial-two-javascript.html)):
```js
// ...
// add worker to specific topic
await runner.subscribe('do.work', (msg, reply) => {
    reply('response.topic', msg + ' world!');
});
// add another worker
// round-robin will be used to cycle between workers
await runner.subscribe('do.work', (msg, reply) => {
    reply('response.topic', msg + ' world! Replies to every other message.');
});
```

You can do achieve the same result by instantiating two different services (e.g. on different servers) and subscribing to the same exchange and topic from them.

## Plugins

Microwork provides basic support for plugins.
Following plugins are currently available:

### Hardware stats plugin

Provides basic hardware stats about node (currently includes cpu with average load and memory information).

Example usage:
```js
import HardwareStat from 'microwork/lib/plugins/hardwarestat';

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

### Health plugin

Provides basic keep-alive signal from node.

Example usage:
```js
import HealthCheck from 'microwork/lib/plugins/healthcheck';

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

### Subscribers info plugin

Provides basic info about subscribers from node.

Example usage:
```js
import SubscriberStats from 'microwork/lib/plugins/substats';

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


## License

[MIT](http://www.opensource.org/licenses/mit-license)
