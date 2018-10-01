const tap = require('tap');
const Microwork = require('../../src');
const HealthCheck = require('../../src/plugins/healthcheck');

const host = 'localhost';

tap.test('HealthCheck', it => {
  it.test('  -> should report every 500ms', t => {
    t.plan(2);
    const exchange = 'master.health.autoreport';
    // create service
    const master = new Microwork({host, exchange});
    // register plugin
    master.registerPlugin(HealthCheck);
    // set report interval to 500 for testing
    master.healthchecksReportInterval = 500;
    // run test
    const run = async () => {
      let index = 2;
      // subscribe
      await master.subscribe('microwork.node.alive', async id => {
        // validate object
        t.equal(id, master.id, '# should get own id');
        index -= 1;
        // if done - stop autoreport and service
        if (index === 0) {
          master.stopAutoreportHealth();
          await master.stop();
          t.end();
        }
      });
      // start autoreport
      master.autoreportHealth();
    };
    run();
  });

  it.end();
});
