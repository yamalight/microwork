import test from 'tape';
import Microwork from '../src';

const queueConfig = {exclusive: true};

test('Microwork', it => {
    it.test('  -> should deliver message from one service to another', async (t) => {
        const exchange = 'master.to.runner';
        // create master and runner services
        const master = new Microwork({host: 'docker.dev', exchange});
        const runner = new Microwork({host: 'docker.dev', exchange});
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
        // add subscription
        await runner.subscribe(topic, consumer);
        // send message
        await master.send(topic, message);
    });

    it.test('  -> should get reply for master query from runner', async (t) => {
        const exchange = 'master.runner.reply';
        // create master and runner
        const master = new Microwork({host: 'docker.dev', exchange});
        const runner = new Microwork({host: 'docker.dev', exchange});
        // test topic and message
        const topic = 'test.request';
        const message = 'ping';
        // test consumer that should receive message
        const consumer = (msg, reply) => {
            t.equal(msg, 'ping', '# should get correct incoming message');
            reply(topic + '.response', 'pong');
        };
        // subscribe for reply
        await master.subscribe(topic + '.response', async (msg) => {
            t.equal(msg, 'pong', '# should get correct reply');
            await master.stop();
            await runner.stop();
            t.end();
        }, queueConfig);
        // subscribe for request
        await runner.subscribe(topic, consumer);
        // send message
        await master.send(topic, message);
    });

    it.test('  -> should use round-robin to distribute tasks between three runners', async (t) => {
        t.plan(6);
        const exchange = 'master.multi.runners';
        // create master and three runners
        const master = new Microwork({host: 'docker.dev', exchange});
        const runner = new Microwork({host: 'docker.dev', exchange});
        const runnerTwo = new Microwork({host: 'docker.dev', exchange});
        const runnerThree = new Microwork({host: 'docker.dev', exchange});
        // test topic and message
        const topic = 'test.request';
        const messages = ['ping', 'ping_two', 'ping_three'];
        const replies = ['pong', 'pong_two', 'ping_three'];
        const repliesCheck = [...replies];
        // test consumer that should receive message
        const consumer = async (idx, msg, reply) => {
            t.equal(msg, messages[idx], '# should get correct incoming message');
            reply(topic + '.response', replies[idx]);
        };
        // subscribe for reply
        await master.subscribe(topic + '.response', async (msg) => {
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
    });

    it.test('  -> should not auto-ack messages', async (t) => {
        t.plan(4);
        const exchange = 'master.noack.runners';
        // create master and three runners
        const master = new Microwork({host: 'docker.dev', exchange});
        const runner = new Microwork({host: 'docker.dev', exchange});
        const runnerTwo = new Microwork({host: 'docker.dev', exchange});
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
            reply(topic + '.response', replies[idx]);
        };
        // always reject messages
        const rejecter = (msg, reply, ack, nack) => nack();
        // subscribe for reply
        await master.subscribe(topic + '.response', async (msg) => {
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
    });

    it.test('  -> should use round-robin to distribute tasks between three subscribers', async (t) => {
        t.plan(6);
        const exchange = 'master.multi.subscribers';
        // create master and three runners
        const master = new Microwork({host: 'docker.dev', exchange});
        const runner = new Microwork({host: 'docker.dev', exchange});
        // test topic and message
        const topic = 'test.request';
        const messages = ['ping', 'ping_two', 'ping_three'];
        const replies = ['pong', 'pong_two', 'ping_three'];
        const repliesCheck = [...replies];
        // test consumer that should receive message
        const consumer = async (idx, msg, reply) => {
            t.equal(msg, messages[idx], '# should get correct incoming message');
            reply(topic + '.response', replies[idx]);
        };
        // subscribe for reply
        await master.subscribe(topic + '.response', async (msg) => {
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
    });

    it.test('  -> should unsubscribe correctly', async (t) => {
        t.plan(8);
        const exchange = 'master.runner.unsubscribe';
        // create master and runner
        const master = new Microwork({host: 'docker.dev', exchange});
        const runner = new Microwork({host: 'docker.dev', exchange});
        const runnerTwo = new Microwork({host: 'docker.dev', exchange});
        // test topic and message
        const topic = 'test.request';
        const message = 'ping';
        const replies = ['pong', 'pong2'];
        let repliesCount = 4;
        // test consumer that should receive message
        const consumer = (msg, reply) => {
            t.equal(msg, 'ping', '# should get correct incoming message');
            reply(topic + '.response', 'pong');
        };
        const consumerTwo = async (msg, reply) => {
            t.equal(msg, 'ping', '# should get correct incoming message in second runner');
            reply(topic + '.response', 'pong2');
        };
        // subscribe for reply
        await master.subscribe(topic + '.response', async (msg) => {
            t.notEqual(replies.indexOf(msg), -1, '# should get correct reply');
            repliesCount--;
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
    });

    it.test('  -> should unsubscribe correctly using consumerTag', async (t) => {
        t.plan(8);
        const exchange = 'master.runner.unsubscribe.tag';
        // create master and runner
        const master = new Microwork({host: 'docker.dev', exchange});
        const runner = new Microwork({host: 'docker.dev', exchange});
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
            reply(topic + '.response', 'pong');
        };
        const consumerTwo = async (msg, reply) => {
            t.equal(msg, 'ping', '# should get correct incoming message in second runner');
            reply(topic + '.response', 'pong2');
        };
        // subscribe for reply
        await master.subscribe(topic + '.response', async (msg) => {
            t.notEqual(replies.indexOf(msg), -1, '# should get correct reply');
            repliesCount--;
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
    });
});
