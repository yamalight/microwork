import test from 'tape';
import initMasterAndRunner, {initRunner} from './init';

test('should deliver message from worker to runner', async (t) => {
    t.plan(1);
    // get master and runner
    const {master, runner, cleanup} = await initMasterAndRunner('master.to.runner');
    // test route and message
    const route = 'test.path';
    const message = {hello: 'world'};
    // test consumer that should receive message
    const consumer = async (msg) => {
        t.deepEqual(message, msg, 'should get correct incoming object');
        await cleanup();
        t.end();
    };

    // add worker
    await runner.addWorker(route, consumer);
    // send message
    await master.run(route, message);
});

test('should get reply for master query from runner', async (t) => {
    t.plan(2);
    // get master and runner
    const {master, runner, cleanup} = await initMasterAndRunner('master.runner.reply');
    // test route and message
    const route = 'test.request';
    const message = 'ping';
    // test consumer that should receive message
    const consumer = async (msg, reply) => {
        t.equal(msg, 'ping', 'should get correct incoming message');
        reply(route + '.response', 'pong');
    };
    // listen for reply
    await master.subscribe(route + '.response', async (msg) => {
        t.equal(msg, 'pong', 'should get correct reply');
        await cleanup();
        t.end();
    });

    // add worker
    await runner.addWorker(route, consumer);
    // send message
    await master.run(route, message);
});

test('should use round-robin to distribute tasks between three runners', async (t) => {
    t.plan(6);
    // get master and runner
    const {master, runner, cleanup} = await initMasterAndRunner('master.multi.runners');
    // init another runner
    const {runner: runnerTwo, cleanup: cleanupTwo} = await initRunner('master.multi.runners');
    // init another runner
    const {runner: runnerThree, cleanup: cleanupThree} = await initRunner('master.multi.runners');
    // test route and message
    const route = 'test.request';
    const messages = ['ping', 'ping_two', 'ping_three'];
    const replies = ['pong', 'pong_two', 'ping_three'];
    // test consumer that should receive message
    const consumer = async (idx, msg, reply) => {
        t.equal(msg, messages[idx], 'should get correct incoming message');
        reply(route + '.response', replies[idx]);
    };
    // listen for reply
    await master.subscribe(route + '.response', async (msg) => {
        t.notEqual(replies.indexOf(msg), -1, 'should get correct reply');
        // cleanup after last msg
        if (msg === replies[replies.length - 1]) {
            await cleanup();
            await cleanupTwo();
            await cleanupThree();
        }
    });

    // add worker
    await runner.addWorker(route, consumer.bind(null, 0));
    await runnerTwo.addWorker(route, consumer.bind(null, 1));
    await runnerThree.addWorker(route, consumer.bind(null, 2));
    // send message
    await master.run(route, messages[0]);
    await master.run(route, messages[1]);
    await master.run(route, messages[2]);
});
