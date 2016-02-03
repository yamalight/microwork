import test from 'tape';
import Microwork from '../src';
import HealthChecks from '../src/plugins/healthcheck';

test('HealthChecks', it => {
    it.test('  -> should report every 500ms', async (t) => {
        t.plan(2);
        const exchange = 'master.health.autoreport';
        // create service
        const master = new Microwork({host: 'docker.dev', exchange});
        // register plugin
        master.registerPlugin(HealthChecks);
        // set report interval to 500 for testing
        master.healthchecksReportInterval = 500;
        // subscribe
        let index = 2;
        await master.subscribe('microwok.node.alive', async (id) => {
            // validate object
            t.equal(id, master.id, '# should get own id');
            index--;
            // if done - stop autoreport and service
            if (index === 0) {
                master.stopAutoreportHealth();
                await master.stop();
                t.end();
            }
        });
        // start autoreport
        master.autoreportHealth();
    });
});
