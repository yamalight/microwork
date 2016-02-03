import test from 'tape';
import sleep from '../src/sleep';

test('Sleep', it => {
    it.test('  -> should be a promise', t => {
        t.ok(sleep(1) instanceof Promise, '# is a promise');
        t.end();
    });

    it.test('  -> should wait for given time', t => {
        const delay = 100;
        const startTime = Date.now();
        sleep(delay).then(() => {
            const diff = Date.now() - startTime;
            t.ok(diff >= delay, '# should be bigger or equal to delay');
            t.ok(diff < (delay * 1.1), '# should be within 10% margin from delay');
            t.end();
        });
    });
});
