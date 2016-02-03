import amqp from 'amqplib';
import sleep from './sleep';
import logger from './logger';

/**
 * Core Microwork class that provides a way to create new microservice
 */
export class Microwork {
    /**
     * Microwork class construct
     * @param  {object} opts            Microwork instance options
     * @param  {string} opts.host       RabbitMQ host to use
     * @param  {string} opts.exchange   RabbitMQ exchange to use
     * @return {void}
     * @example
     * const service = new Microwork({host: 'localhost', exchange: 'test.exchange'});
     */
    constructor({host = 'localhost', exchange = 'microwork.default.exchange'}) {
        logger.debug('construct with', host, exchange);
        /**
         * RabbitMQ host address
         * @type {string}
         */
        this.host = host;
        /**
         * RabbitMQ exchange name
         * @type {string}
         */
        this.exchange = exchange;
        /**
         * Active route handlers and queues
         * @type {Object}
         */
        this.routeHandlers = {};
        /**
         * Connecting indicator
         * @type {Boolean}
         * @private
         */
        this.connecting = false;
        /**
         * Connection to RabbitMQ instance
         * @type {Object}
         * @private
         */
        this.connection = undefined;
        /**
         * Connection to RabbitMQ instance
         * @type {Object}
         * @private
         */
        this.channel = undefined;
        // init connection
        this.connect();
    }

    /**
     * Initializes connection to RabbitMQ
     * @return {Promise} Returns promise that can be awaited to ensure connection
     * @private
     */
    async connect() {
        // if connecting, wait a bit, then return self
        if (this.connecting) {
            return sleep(50).then(() => this.connect());
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

    /**
     * Removes existing subscription or worker
     * @param  {string} topic Topic to remove subscription/worker from
     * @return {Promise} Returns promise that can be awaited to ensure removal
     * @example
     * await microworkInstance.unsubscribe('test.topic');
     */
    async unsubscribe(topic) {
        // cancel consuming
        await this.channel.cancel(this.routeHandlers[topic].consumerTag);
        // remove refs
        delete this.routeHandlers[topic];
    }

    /**
     * Stops the service, closes all workers/subscriptions and terminates the connection to RabbitMQ
     * @return {Promise} Returns promise that can be awaited to ensure termination
     * @example
     * await microworkInstance.stop();
     */
    async stop() {
        // cleanup queues and routes if any are present
        const paths = Object.keys(this.routeHandlers);
        if (paths.length) {
            await Promise.all(paths.map(path => this.unsubscribe(path)));
        }
        // close channel & connection
        await this.channel.close();
        await this.connection.close();
    }

    /**
     * Send given data to the specified topic
     * @param  {string} topic Topic to send data to
     * @param  {Any}    data  Data to send
     * @return {Promise}      Returns promise that can be awaited to ensure termination
     * @example
     * await microworkInstance.send('test.topic', 'test');
     * await microworkInstance.send('test.topic', {json: 'works too'});
     */
    async send(topic, data) {
        // wait for connection
        await this.connect();
        // send
        logger.debug('sending to', topic, 'data:', data);
        this.channel.publish(this.exchange, topic, new Buffer(JSON.stringify(data)));
    }

    /**
     * Create subscription to given topic that will pass all incoming messages to given handler
     * @param  {string}   topic        Topic to subscribe to
     * @param  {Function} handler      Handler function that will get all incoming messages
     * @param  {Object}   queueConfig  Queue config to pass to RabbitMQ
     * @return {Promise}               Returns promise that can be awaited to ensure termination
     * @example <caption>Simple subscribe usage</caption>
     * await microworkInstance.subscribe('test.topic', (msg, reply) => {
     * 	if (msg === 'ping') {
     * 		reply('test.reply', 'pong');
     * 	}
     * });
     * @example <caption>Subscribe with custom RabbitMQ options</caption>
     * await microworkInstance.subscribe('test.topic', (msg, reply) => {
     * 	if (msg === 'ping') {
     * 		reply('test.reply', 'pong');
     * 	}
     * }, {durable: true, exclusive: true});
     */
    async subscribe(topic, handler, queueConfig = {durable: true}) {
        // wait for connection
        await this.connect();
        // get queue
        logger.debug('adding worker for:', topic);
        const {queue} = await this.channel.assertQueue(`microwork-${topic}-queue`, queueConfig);
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
