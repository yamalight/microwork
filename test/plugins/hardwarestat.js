const tap = require('tap');
const Microwork = require('../../src');
const HardwareStat = require('../../src/plugins/hardwarestat');

const host = 'localhost';

tap.test('HardwareStat', it => {
  it.test('  -> should report every 500ms', t => {
    t.plan(4);
    const exchange = 'master.hardware.autoreport';
    // create service
    const master = new Microwork({host, exchange});
    // register plugin
    master.registerPlugin(HardwareStat);
    // set report interval to 500 for testing
    master.hardwareReportInterval = 500;
    // run test
    const run = async () => {
      // subscribe
      let index = 2;
      await master.subscribe('microwork.node.status', async stats => {
        // validate object
        t.ok(stats.hasOwnProperty('cpu'), '# should have cpu stats');
        t.ok(stats.hasOwnProperty('mem'), '# should have mem stats');
        index -= 1;
        // if done - stop autoreport and service
        if (index === 0) {
          master.stopAutoreportHardwareStats();
          await master.stop();
          t.end();
        }
      });
      // start autoreport
      master.autoreportHardwareStats();
    };
    run();
  });

  it.end();
});
