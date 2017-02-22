const tap = require('tap');
const amqp = require('amqplib');
const Microwork = require('../src');

const queueConfig = {exclusive: true};
const host = 'localhost';

tap.test('Microwork', (it) => {
  it.test('  -> should deliver message from one service to another', (t) => {
    const exchange = 'master.to.runner';
    // create master and runner services
    const master = new Microwork({host, exchange});
    const runner = new Microwork({host, exchange});
    // test topic and message
    const topic = 'test.path';
    const message = {hello: 'world'};
    // test consumer that should receive message
    const consumer = async (msg) => {
      t.deepEqual(message, msg, '# should get correct incoming object');
      await master.stop();
      await runner.stop();
      t.end();
    };
    const sendMessages = async () => {
      // add subscription
      await runner.subscribe(topic, consumer);
      // send message
      await master.send(topic, message);
    };
    sendMessages();
  });

  it.test('  -> should get reply for master query from runner', (t) => {
    const exchange = 'master.runner.reply';
    // create master and runner
    const master = new Microwork({host, exchange});
    const runner = new Microwork({host, exchange});
    // test topic and message
    const topic = 'test.request';
    const message = 'ping';
    // test consumer that should receive message
    const consumer = (msg, reply, ack, nack, metadata) => {
      // validate message
      t.equal(msg, 'ping', '# should get correct incoming message');
      // validate metadata
      t.equal(metadata.fields.deliveryTag, 1, '# should have correct deliveryTag');
      t.equal(metadata.fields.redelivered, false, '# should not be redelivered');
      t.equal(metadata.fields.exchange, exchange, '# should have correct exchange');
      t.equal(metadata.fields.routingKey, topic, '# should have correct routingKey');
      reply(`${topic}.response`, 'pong');
    };
    const run = async () => {
      // subscribe for reply
      await master.subscribe(`${topic}.response`, async (msg) => {
        t.equal(msg, 'pong', '# should get correct reply');
        await master.stop();
        await runner.stop();
        t.end();
      }, queueConfig);
      // subscribe for request
      await runner.subscribe(topic, consumer);
      // send message
      await master.send(topic, message);
    };
    run();
  });

  it.test('  -> should use round-robin to distribute tasks between three runners', (t) => {
    t.plan(6);
    const exchange = 'master.multi.runners';
    // create master and three runners
    const master = new Microwork({host, exchange});
    const runner = new Microwork({host, exchange});
    const runnerTwo = new Microwork({host, exchange});
    const runnerThree = new Microwork({host, exchange});
    // test topic and message
    const topic = 'test.request';
    const messages = ['ping', 'ping_two', 'ping_three'];
    const replies = ['pong', 'pong_two', 'ping_three'];
    const repliesCheck = [...replies];
    // test consumer that should receive message
    const consumer = async (idx, msg, reply) => {
      t.equal(msg, messages[idx], '# should get correct incoming message');
      reply(`${topic}.response`, replies[idx]);
    };
    const run = async () => {
      // subscribe for reply
      await master.subscribe(`${topic}.response`, async (msg) => {
        // check
        const index = repliesCheck.indexOf(msg);
        t.notEqual(index, -1, '# should get correct reply');
        // remove from array
        repliesCheck.splice(index, 1);
        // cleanup after last msg
        if (repliesCheck.length === 0) {
          await master.stop();
          await runner.stop();
          await runnerTwo.stop();
          await runnerThree.stop();
        }
      }, queueConfig);

      // add subscriptions for consumers
      await runner.subscribe(topic, consumer.bind(null, 0));
      await runnerTwo.subscribe(topic, consumer.bind(null, 1));
      await runnerThree.subscribe(topic, consumer.bind(null, 2));
      // send messages
      await master.send(topic, messages[0]);
      await master.send(topic, messages[1]);
      await master.send(topic, messages[2]);
    };
    run();
  });

  it.test('  -> should not auto-ack messages', (t) => {
    t.plan(4);
    const exchange = 'master.noack.runners';
    // create master and three runners
    const master = new Microwork({host, exchange});
    const runner = new Microwork({host, exchange});
    const runnerTwo = new Microwork({host, exchange});
    // test topic and message
    const topic = 'test.request';
    const messages = ['ping', 'ping_two'];
    const replies = ['pong', 'pong_two'];
    const repliesCheck = [...replies];
    // test consumer that should receive message
    const consumer = async (msg, reply, ack) => {
      const idx = messages.indexOf(msg);
      t.notEqual(idx, -1, '# should get correct incoming message');
      ack();
      reply(`${topic}.response`, replies[idx]);
    };
    // always reject messages
    const rejecter = (msg, reply, ack, nack) => nack();
    const run = async () => {
      // subscribe for reply
      await master.subscribe(`${topic}.response`, async (msg) => {
        // check
        const index = repliesCheck.indexOf(msg);
        t.notEqual(index, -1, '# should get correct reply');
        // remove from array
        repliesCheck.splice(index, 1);
        // cleanup after last msg
        if (repliesCheck.length === 0) {
          await master.stop();
          await runner.stop();
          await runnerTwo.stop();
        }
      }, queueConfig);

      // add subscriptions for consumers
      await runner.subscribe(topic, consumer, {}, {}, {ack: false});
      await runnerTwo.subscribe(topic, rejecter, {}, {}, {ack: false});
      // send messages
      await master.send(topic, messages[0]);
      await master.send(topic, messages[1]);
    };
    run();
  });

  it.test('  -> should use round-robin to distribute tasks between three subscribers', (t) => {
    t.plan(6);
    const exchange = 'master.multi.subscribers';
    // create master and three runners
    const master = new Microwork({host, exchange});
    const runner = new Microwork({host, exchange});
    // test topic and message
    const topic = 'test.request';
    const messages = ['ping', 'ping_two', 'ping_three'];
    const replies = ['pong', 'pong_two', 'ping_three'];
    const repliesCheck = [...replies];
    // test consumer that should receive message
    const consumer = async (idx, msg, reply) => {
      t.equal(msg, messages[idx], '# should get correct incoming message');
      reply(`${topic}.response`, replies[idx]);
    };
    const run = async () => {
      // subscribe for reply
      await master.subscribe(`${topic}.response`, async (msg) => {
        // check
        const index = repliesCheck.indexOf(msg);
        t.notEqual(index, -1, '# should get correct reply');
        // remove from array
        repliesCheck.splice(index, 1);
        // cleanup after last msg
        if (repliesCheck.length === 0) {
          await master.stop();
          await runner.stop();
        }
      }, queueConfig);

      // add subscriptions for consumers
      await runner.subscribe(topic, consumer.bind(null, 0));
      await runner.subscribe(topic, consumer.bind(null, 1));
      await runner.subscribe(topic, consumer.bind(null, 2));
      // send messages
      await master.send(topic, messages[0]);
      await master.send(topic, messages[1]);
      await master.send(topic, messages[2]);
    };
    run();
  });

  it.test('  -> should unsubscribe correctly', (t) => {
    t.plan(8);
    const exchange = 'master.runner.unsubscribe';
    // create master and runner
    const master = new Microwork({host, exchange});
    const runner = new Microwork({host, exchange});
    const runnerTwo = new Microwork({host, exchange});
    // test topic and message
    const topic = 'test.request';
    const message = 'ping';
    const replies = ['pong', 'pong2'];
    let repliesCount = 4;
    // test consumer that should receive message
    const consumer = (msg, reply) => {
      t.equal(msg, 'ping', '# should get correct incoming message');
      reply(`${topic}.response`, 'pong');
    };
    const consumerTwo = async (msg, reply) => {
      t.equal(msg, 'ping', '# should get correct incoming message in second runner');
      reply(`${topic}.response`, 'pong2');
    };
    const run = async () => {
      // subscribe for reply
      await master.subscribe(`${topic}.response`, async (msg) => {
        t.notEqual(replies.indexOf(msg), -1, '# should get correct reply');
        repliesCount -= 1;
        if (msg === 'pong2') {
          // unsubscribe second runner
          await runnerTwo.unsubscribe(topic);
          // remove second answer
          replies.splice(1, 1);
          // send two more messages
          await master.send(topic, message);
          await master.send(topic, message);
          return;
        }
        if (repliesCount === 0) {
          await master.stop();
          await runner.stop();
          await runnerTwo.stop();
          t.end();
        }
      }, queueConfig);
      // subscribe for requests
      await runner.subscribe(topic, consumer);
      await runnerTwo.subscribe(topic, consumerTwo);
      // send message
      await master.send(topic, message);
      await master.send(topic, message);
    };
    run();
  });

  it.test('  -> should unsubscribe correctly using consumerTag', (t) => {
    t.plan(8);
    const exchange = 'master.runner.unsubscribe.tag';
    // create master and runner
    const master = new Microwork({host, exchange});
    const runner = new Microwork({host, exchange});
    // test topic and message
    const topic = 'test.request';
    const message = 'ping';
    const replies = ['pong', 'pong2'];
    // replies count and tag to unsub
    let repliesCount = 4;
    let tag;
    // test consumer that should receive message
    const consumer = (msg, reply) => {
      t.equal(msg, 'ping', '# should get correct incoming message');
      reply(`${topic}.response`, 'pong');
    };
    const consumerTwo = async (msg, reply) => {
      t.equal(msg, 'ping', '# should get correct incoming message in second runner');
      reply(`${topic}.response`, 'pong2');
    };
    const run = async () => {
      // subscribe for reply
      await master.subscribe(`${topic}.response`, async (msg) => {
        t.notEqual(replies.indexOf(msg), -1, '# should get correct reply');
        repliesCount -= 1;
        if (msg === 'pong2') {
          // unsubscribe second consumer using tag
          await runner.unsubscribe(topic, tag);
          // remove second answer
          replies.splice(1, 1);
          // send two more messages
          await master.send(topic, message);
          await master.send(topic, message);
          return;
        }
        if (repliesCount === 0) {
          await master.stop();
          await runner.stop();
          t.end();
        }
      }, queueConfig);
      // subscribe for requests
      await runner.subscribe(topic, consumer);
      // subscribe with second consumer and save tag
      tag = await runner.subscribe(topic, consumerTwo);
      // send message
      await master.send(topic, message);
      await master.send(topic, message);
    };
    run();
  });

  it.test('  -> should try to reconnect to rabbit on fail', (t) => {
    // create worker
    const master = new Microwork({host: 'rabbit.dev:1234', reconnectTimeout: 500});
    // override connect function to make sure it's called second time
    master.connect = () => {
      t.ok(true, '# should try to reconnect');
      t.end();
      return new Promise(r => r());
    };
  });

  it.test('  -> should allow stopping while trying to reconnect to rabbit', (t) => {
    // create worker
    const master = new Microwork({host: 'rabbit.dev:1234', reconnectTimeout: 1000});
    setTimeout(async () => {
      await master.stop();
      t.ok(true, '# should stop connection retries');
      t.end();
    }, 100);
  });

  it.test('  -> should allow calling send while trying to reconnect to rabbit', (t) => {
    // create worker
    const exchange = 'reconnect.text.exchange';
    const master = new Microwork({host, exchange});
    const worker = new Microwork({host: 'rabbit.dev:1234', exchange, reconnectTimeout: 500});
    // subscribe to message from master
    const topic = 'test.topic';
    const testMessage = 'hello';
    const run = async () => {
      await master.subscribe(topic, async (msg) => {
        t.equal(msg, testMessage, '# should receive test message');
        t.end();
        await master.stop();
        await worker.stop();
      });
      // say we want to post message
      worker.send(topic, testMessage);
      // swap out host for real one so that next connect goes through
      worker.host = 'docker.dev';
    };
    run();
  });

  it.test('  -> should use custom subscription and send configs', (t) => {
    const exchange = 'custom.cfg';
    const topic = 'test';
    const defaultQueueConfig = {durable: true, autoDelete: false};
    const defaultConsumeConfig = {noAck: false};
    const defaultSubscribeConfig = {ack: true};
    const defaultSendConfig = {persistent: true};
    const master = new Microwork({host, exchange, defaultSendConfig});
    const worker = new Microwork({
      host,
      exchange,
      defaultQueueConfig,
      defaultConsumeConfig,
      defaultSubscribeConfig,
    });

    const run = async () => {
      const connection = await amqp.connect(`amqp://${host}`);
      const channel = await connection.createChannel();
      channel.on('error', () => {}); // noop on error to stop code from throwing
      await channel.assertExchange(exchange, 'topic');

      const tag = await worker.subscribe(topic, async (msg, reply, ack, nack, metadata) => {
        t.equal(metadata.properties.deliveryMode, 2, '# should have correct delivery mode');
        await worker.unsubscribe(topic, tag);
        await master.stop();
        await worker.stop();

        // try to assert queue with default params (should fail)
        try {
          await channel.assertQueue(`microwork-${topic}-queue`, master.defaultQueueConfig);
        } catch (e) {
          t.ok(e);
          t.ok(e.message.includes(`PRECONDITION_FAILED - inequivalent arg 'auto_delete' for queue 'microwork-test-queue' in vhost '/': received 'true' but current is 'false'`),
            '# should have correct error message');
        }

        await connection.close();
        t.end();
      });

      await master.send(topic, 'test');
    };
    run();
  });

  it.end();
});
