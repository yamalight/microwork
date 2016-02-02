import amqp from 'amqplib';
import Logger from './logger';
const logger = Logger('rabbit', 'info');

export class Rabbit {
    constructor({host = 'localhost', exchange = 'microwork.default.exchange'}) {
        logger.debug('construct with', host, exchange);
        this.host = host;
        this.exchange = exchange;
        this.routeHandlers = {};
    }

    async connect() {
        // start listening & catch errors
        return this.listen({host: this.host, exchange: this.exchange});
    }

    async listen() {
        // connect
        this.connection = await amqp.connect(`amqp://${this.host}`);
        logger.debug('connected to rabbit');
        // get two channels - receive and send
        this.channel = await this.connection.createChannel();
        logger.debug('got channels');
        // assing topic
        await this.channel.assertExchange(this.exchange, 'topic');
        logger.debug('got exchanges');
        // say we want to prefetch only 1 msg
        await this.channel.prefetch(1);
        logger.debug('prefetch set');
    }

    async close() {
        // cleanup queues and routes if any are present
        const ch = this.channel;
        const rh = this.routeHandlers;
        const paths = Object.keys(rh);
        if (paths.length) {
            await Promise.all(
                paths.map(path => ch.unbindQueue(rh[path].queue, this.exchange, path)
                    .then(() => ch.deleteQueue(rh[path].queue))
                    .then(() => ch.cancel(rh[path].consumerTag))
                )
            );
        }
        // close channel & connection
        await this.channel.close();
        await this.connection.close();
    }
}
