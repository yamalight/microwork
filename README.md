Microwork.js
=========================

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
import {Runner} from 'microwork';

// create task runner
const runner = new Runner({host: 'your.rabbit.host', exchange: 'your.exchange'});
// connect it to rabbit
await runner.connect();
// add worker to specific route
await runner.addWorker('do.work', (msg, reply) => {
    reply('response.topic', msg + ' world!');
});
// after work is done - cleanup
await runner.stop();
```

Example master service:
```js
import {Master} from 'microwork';

// create master
const master = new Master({host: 'your.rabbit.host', exchange: 'your.exchange'});
// connect
await master.connect();
// listen for reply from workers
await master.subscribe('response.topic', (msg) => {
    console.log(msg); // -> "hello world!"
});
// send message to workers
await master.run('do.work', 'hello');

// after work is done - cleanup
await master.stop();

```

TODO: more docs

## License

[MIT](http://www.opensource.org/licenses/mit-license)
