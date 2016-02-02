import uuid from 'node-uuid';
import {Rabbit} from './rabbit';
import Logger from './logger';
const logger = Logger('master');

export class Master extends Rabbit {
    constructor({host, exchange}) {
        super({host, exchange});
    }

    async stop() {
        logger.debug('stopping master...');
        await this.close();
        logger.info('master stopped!');
    }

    async subscribe(topic, handler) {
        const id = uuid.v4();
        const {queue} = await this.channel.assertQueue(`microwork-reply-${id}-queue`, {
            exclusive: true,
            durable: true,
        });
        logger.debug('inited queue for', topic);
        // bind to key
        await this.channel.bindQueue(queue, this.exchange, topic);
        logger.debug('bound queue for', topic);
        // listen for messages
        const {consumerTag} = await this.channel.consume(queue, (data) => {
            if (!data) {
                return;
            }
            const msg = JSON.parse(data.content.toString());
            logger.debug('got message:', msg);
            // acknowledge
            this.channel.ack(data);
            // return depending on type
            handler(msg);
        }, {noAck: false});
        // push to cleanup
        this.routeHandlers[topic] = {
            queue,
            consumerTag,
        };
        logger.info('master subscribtion inited, consuming...');
    }

    async run(route, data) {
        // send
        logger.debug('sending:', data);
        this.channel.publish(this.exchange, route, new Buffer(JSON.stringify(data)));
    }
}
