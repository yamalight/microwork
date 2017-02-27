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

## Persistent queues and messaging

By default Microwork queues and messages are non-persistent.
So, if nobody's listening on other end at the moment of dispatch - messages will just disappear.
And queues will be desctructed once there are no subscribers, or upon RabbitMQ restart.  
Sometimes you might want to have persistent queues and messages.
This can be achieved by providing the following configs during the Microwork service instantiation:
```js
// define configs
const queueConfig = {
  durable: true, // queue should survive daemon restart
  autoDelete: false, // queues should not be auto-deleted
};
const sendConfig = {
  persistent: true, // make messages survive daemon restart
};
// pass them to your new microwork service
const service = new Microwork({
  host,
  exchange,
  defaultQueueConfig: queueConfig,
  defaultSendConfig: sendConfig,
});
```
