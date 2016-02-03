import test from 'tape';
import Microwork from '../src';
import HardwareStat from '../src/plugins/hardwarestat';

test('HardwareStat', it => {
    it.test('  -> should report every 1s', async (t) => {
        t.plan(4);
        const exchange = 'master.hardware.autoreport';
        // create service
        const master = new Microwork({host: 'docker.dev', exchange});
        // register plugin
        master.registerPlugin(HardwareStat);
        // set report interval to 500 for testing
        master.hardwareReportInterval = 500;
        // subscribe
        let index = 2;
        await master.subscribe('microwok.node.status', async (stats) => {
            // validate object
            t.ok(stats.hasOwnProperty('cpu'), '# should have cpu stats');
            t.ok(stats.hasOwnProperty('mem'), '# should have mem stats');
            index--;
            // if done - stop autoreport and service
            if (index === 0) {
                master.stopAutoreportHardwareStats();
                await master.stop();
                t.end();
            }
        });
        // start autoreport
        master.autoreportHardwareStats();
    });
});
