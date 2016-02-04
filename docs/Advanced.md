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
