Microwork.js
=========================

[![npm](https://img.shields.io/npm/v/microwork.svg)](https://www.npmjs.com/package/microwork)
[![MIT](https://img.shields.io/npm/l/microwork.svg)](http://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/yamalight/microwork.svg?branch=master)](https://travis-ci.org/yamalight/microwork)
[![bitHound Overall Score](https://www.bithound.io/github/yamalight/microwork/badges/score.svg)](https://www.bithound.io/github/yamalight/microwork)
[![Coverage Status](https://coveralls.io/repos/github/yamalight/microwork/badge.svg?branch=master)](https://coveralls.io/github/yamalight/microwork?branch=master)

Microwork.js is a library for simple creation of distributed scalable microservices in node.js with RabbitMQ.

# Installation
```sh
npm install --save microwork
```

# Requirements

Since Microwork.js is written in ES6 and it uses async/await - it requires latest stable node (7.x or later).

# Features

* Simple interface for building distributed (micro)services
* Easy way to scale services both horizontally (by adding more nodes) and vertically (by adding more subscribers)
* Extensible with [plugins](docs/Plugins.md)

# Usage

## Quick start

Example service that subscribe to messages from `do.work` topic and does some work with incoming data (in this case it just appends ` world!` to incoming string):
```js
const Microwork = require('microwork');

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
const Microwork = require('microwork');

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

For more examples see project [documentation](docs/README.md).

## License

[MIT](http://www.opensource.org/licenses/mit-license)
