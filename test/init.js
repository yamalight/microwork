import {Master, Runner} from '../lib';

export const initRunner = async (exchange) => {
    const runner = new Runner({host: 'docker.dev', exchange});
    await runner.connect();
    return {
        runner,
        async cleanup() {
            await runner.stop();
        },
    };
};

export default async (exchange) => {
    // construct
    const runner = new Runner({host: 'docker.dev', exchange});
    const master = new Master({host: 'docker.dev', exchange});
    // connect
    await runner.connect();
    await master.connect();

    return {
        master,
        runner,
        async cleanup() {
            await runner.stop();
            await master.stop();
        },
    };
};
