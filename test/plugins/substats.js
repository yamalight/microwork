import test from 'tape';
import Microwork from '../../src';
import SubscriberStats from '../../src/plugins/substats';

test('SubscriberStats', it => {
    it.test('  -> should report every 500ms', async (t) => {
        // t.plan(2);
        const exchange = 'master.substats.report';
        // create service
        const master = new Microwork({host: 'docker.dev', exchange});
        // register plugin
        master.registerPlugin(SubscriberStats);
        // dummy subscription
        const testSubs = ['test.sub', 'test.other.sub'];
        await master.subscribe(testSubs[0], () => {});
        // dummy subscription
        await master.subscribe(testSubs[1], () => {});
        // subscribe
        await master.subscribe('microwork.node.subscribers', async (info) => {
            // validate object
            t.equal(info.id, master.id, '# should get own id');
            t.notEqual(info.subscribers.indexOf(testSubs[0]), -1, '# should contain test subscription one');
            t.notEqual(info.subscribers.indexOf(testSubs[1]), -1, '# should contain test subscription two');
            await master.stop();
            t.end();
        });
        // init sub report
        master.initSubscribersReporting();
        // send request with delay
        setTimeout(() => {
            master.send('microwork.node.report.subscribers');
        }, 100);
    });
});
