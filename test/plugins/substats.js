/* eslint max-nested-callbacks: [2, 4] */
const tap = require('tap');
const Microwork = require('../../src');
const SubscriberStats = require('../../src/plugins/substats');

tap.test('SubscriberStats', (it) => {
  it.test('  -> should report every 500ms', (t) => {
    // t.plan(2);
    const exchange = 'master.substats.report';
    // create service
    const master = new Microwork({host: 'docker.dev', exchange});
    // register plugin
    master.registerPlugin(SubscriberStats);
    // dummy subscription
    const testSubs = ['test.sub', 'test.other.sub'];
    const run = async () => {
      await master.subscribe(testSubs[0], () => {});
      await master.subscribe(testSubs[1], () => {});
      await master.subscribe(testSubs[1], () => {});
      // subscribe
      await master.subscribe('microwork.node.subscribers', async (info) => {
        // validate object
        t.equal(info.id, master.id, '# should get own id');
        t.equal(info.subscribers.find(sub => sub.topic === testSubs[0]).subscribers, 1,
          '# should contain test subscription one');
        t.equal(info.subscribers.find(sub => sub.topic === testSubs[1]).subscribers, 2,
          '# should contain test subscription two');
        await master.stop();
        t.end();
      });
      // init sub report
      master.initSubscribersReporting();
      // send request with delay
      setTimeout(() => {
        master.send('microwork.node.report.subscribers');
      }, 100);
    };
    run();
  });

  it.end();
});
