Microwork.js
=========================

[![npm](https://img.shields.io/npm/v/microwork.svg)](https://www.npmjs.com/package/microwork)
[![MIT](https://img.shields.io/npm/l/microwork.svg)](http://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/yamalight/microwork.svg?branch=master)](https://travis-ci.org/yamalight/microwork)
[![bitHound Overall Score](https://www.bithound.io/github/yamalight/microwork/badges/score.svg)](https://www.bithound.io/github/yamalight/microwork)
[![Coverage Status](https://coveralls.io/repos/github/yamalight/microwork/badge.svg?branch=master)](https://coveralls.io/github/yamalight/microwork?branch=master)


Microwork.js is a library for simple creation of distributed scalable task runners in node.js with RabbitMQ.

# Installation
```sh
npm install --save microwork
```

# Requirements

Since Microwork.js is written in ES6, it uses [babel](https://babeljs.io/) to compile the code before publishing. Currently we're using [es2015-node](https://github.com/rtsao/babel-preset-es2015-node) babel preset that only works in latest stable node (4.x or later).

# Features

TODO: describe me

# Usage

## Quick start

Example runner service:
```js
import Microwork from 'microwork';

// create task runner
const runner = new Microwork({host: 'your.rabbit.host', exchange: 'your.exchange'});
// add worker to specific topic
await runner.addWorker('do.work', (msg, reply) => {
    reply('response.topic', msg + ' world!');
});
// after work is done - cleanup
await runner.stop();
```

Example master service:
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

TODO: more docs

## License

[MIT](http://www.opensource.org/licenses/mit-license)
