import uuid from 'node-uuid';
import {Rabbit} from './rabbit';
import Logger from './logger';
const logger = Logger('runner');

export class Runner extends Rabbit {
    constructor({host, exchange}) {
        super({host, exchange});
    }

    async stop() {
        logger.debug('stopping runner...');
        await this.close();
        logger.info('runner stopped!');
    }

    async reply(route, data) {
        // send
        logger.debug('sending:', data);
        this.channel.publish(this.exchange, route, new Buffer(JSON.stringify(data)));
    }

    async addWorker(topic, handler) {
        logger.debug('adding worker for:', topic);
        const {queue} = await this.channel.assertQueue(`microwork-${topic}-queue`, {durable: true});
        await this.channel.bindQueue(queue, this.exchange, topic);
        logger.debug('bound queue...');
        // consume if needed
        logger.debug('initiating consuming...');
        // listen for messages
        const {consumerTag} = await this.channel.consume(queue, data => {
            if (!data) {
                return;
            }
            const msg = JSON.parse(data.content.toString());
            // ack
            this.channel.ack(data);
            // pass to handler
            const reply = this.reply.bind(this);
            handler(msg, reply);
        }, {noAck: false});
        // push to cleanup
        this.routeHandlers[topic] = {
            queue,
            consumerTag,
        };
        logger.info('worker inited, consuming...');
    }
}

// bind to keys
// await channel.bindQueue(queue, rabbit.exchange, executeRoute);
// await channel.bindQueue(queue, rabbit.exchange, killRoute);
// await channel.bindQueue(queue, rabbit.exchange, commandRoute);
// await channel.bindQueue(queue, rabbit.exchange, compileRoute);
// logger.debug('bound queue, consuming...');
