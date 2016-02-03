import test from 'tape';
import Microwork from '../src';

test('Microwork', it => {
    it.test('  -> should deliver message from worker to runner', async (t) => {
        // get master and runner
        const exchange = 'master.to.runner';
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

        // add worker
        await runner.addWorker(topic, consumer);
        // send message
        await master.send(topic, message);
    });

    it.test('should get reply for master query from runner', async (t) => {
        // get master and runner
        const exchange = 'master.runner.reply';
        const master = new Microwork({host: 'docker.dev', exchange});
        const runner = new Microwork({host: 'docker.dev', exchange});
        // test topic and message
        const topic = 'test.request';
        const message = 'ping';
        // test consumer that should receive message
        const consumer = (msg, reply) => {
            t.equal(msg, 'ping', 'should get correct incoming message');
            reply(topic + '.response', 'pong');
        };
        // listen for reply
        await master.subscribe(topic + '.response', async (msg) => {
            t.equal(msg, 'pong', 'should get correct reply');
            await master.stop();
            await runner.stop();
            t.end();
        });

        // add worker
        await runner.addWorker(topic, consumer);
        // send message
        await master.send(topic, message);
    });

    it.test('should use round-robin to distribute tasks between three runners', async (t) => {
        t.plan(6);
        // get master and three runners
        const exchange = 'master.multi.runners';
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
            t.equal(msg, messages[idx], 'should get correct incoming message');
            reply(topic + '.response', replies[idx]);
        };
        // listen for reply
        await master.subscribe(topic + '.response', async (msg) => {
            // check
            const index = repliesCheck.indexOf(msg);
            t.notEqual(index, -1, 'should get correct reply');
            // remove from array
            repliesCheck.splice(index, 1);
            // cleanup after last msg
            if (repliesCheck.length === 0) {
                await master.stop();
                await runner.stop();
                await runnerTwo.stop();
                await runnerThree.stop();
            }
        });

        // add worker
        await runner.addWorker(topic, consumer.bind(null, 0));
        await runnerTwo.addWorker(topic, consumer.bind(null, 1));
        await runnerThree.addWorker(topic, consumer.bind(null, 2));
        // send message
        await master.send(topic, messages[0]);
        await master.send(topic, messages[1]);
        await master.send(topic, messages[2]);
    });
});
