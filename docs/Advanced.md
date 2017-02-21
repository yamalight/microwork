# Advanced Usage

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

## Overriding logging options

Microwork uses [winston](https://github.com/winstonjs/winston) output for logging.
By default Console logger is used, but it is possible to override logger transport settings.
You can do that by passing an array of logging transports you wish to use to Microwork constructor, like so:
```js
const winston = require('winston');

const loggingTransports = [new winston.transports.Console({level: 'error'})];

const runner = new Microwork({loggingTransports});
```
