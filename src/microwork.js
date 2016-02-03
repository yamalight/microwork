import amqp from 'amqplib';
import uuid from 'node-uuid';
import sleep from './sleep';
import logger from './logger';

export class Microwork {
    constructor({host = 'localhost', exchange = 'microwork.default.exchange'}) {
        logger.debug('construct with', host, exchange);
        this.host = host;
        this.exchange = exchange;
        this.routeHandlers = {};
        this.connecting = false;
        // init connection
        this.listen();
    }

    async listen() {
        // if connecting, wait a bit, then return self
        if (this.connecting) {
            return sleep(50).then(() => this.listen());
        }
        // do not do anything if already connected
        if (this.connection) {
            return true;
        }

        logger.debug('connecting...');
        // we're connecting
        this.connecting = true;
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
        // we're done connecting
        this.connecting = false;
    }

    async removeSubscription(topic) {
        await this.channel.unbindQueue(this.routeHandlers[topic].queue, this.exchange, topic);
        await this.channel.deleteQueue(this.routeHandlers[topic].queue);
        await this.channel.cancel(this.routeHandlers[topic].consumerTag);
    }

    async stop() {
        // cleanup queues and routes if any are present
        const paths = Object.keys(this.routeHandlers);
        if (paths.length) {
            await Promise.all(paths.map(path => this.removeSubscription(path)));
        }
        // close channel & connection
        await this.channel.close();
        await this.connection.close();
    }

    async subscribe(topic, handler) {
        // wait for connection
        await this.listen();
        // generate id
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

    async send(topic, data) {
        // wait for connection
        await this.listen();
        // send
        logger.debug('sending to', topic, 'data:', data);
        this.channel.publish(this.exchange, topic, new Buffer(JSON.stringify(data)));
    }

    async addWorker(topic, handler) {
        // wait for connection
        await this.listen();
        // get queue
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
            const reply = this.send.bind(this);
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
