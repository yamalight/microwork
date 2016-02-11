import amqp from 'amqplib';
import uuid from 'node-uuid';
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
         * Service unique ID
         * @type {string}
         */
        this.id = uuid.v4();
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
     * Register new Microwork plugin
     * @param  {Object} plugin      Microwork plugin object
     * @return {void}
     * @example
     * import myMicroworkPlugin from 'my-microwork-plugin';
     * microworkInstance.registerPlugin(myMicroworkPlugin);
     */
    registerPlugin(plugin) {
        for (const prop in plugin) {
            // only apply non-existent properties
            if (!this.hasOwnProperty(prop)) {
                /**
                 * New property from plugin
                 * @private
                 */
                this[prop] = plugin[prop];
            }
        }
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
     * Removes existing subscription or worker.
     * If consumerTag is given only corresponding subscription will be removed.
     * Otherwise, all consumers for given topic will be terminated.
     * @param  {string} topic         Topic to remove subscription/worker from
     * @param  {string} consumerTag   Consumer tag to unsubscribe with
     * @return {Promise} Returns promise that can be awaited to ensure removal
     * @example <caption>Remove one subscription with consumerTag</caption>
     * await microworkInstance.unsubscribe('test.topic', 'tag');
     * @example <caption>Remove all subscriptions with topic</caption>
     * await microworkInstance.unsubscribe('test.topic');
     */
    async unsubscribe(topic, consumerTag) {
        // if we have consumerTag - only unsub from it
        if (consumerTag) {
            // find index
            const subIndex = this.routeHandlers[topic].findIndex(it => it.consumerTag === consumerTag);
            // cancel consuming
            await this.channel.cancel(consumerTag);
            // remove from subs
            this.routeHandlers[topic].splice(subIndex, 1);
            return;
        }
        // cancel consuming
        await Promise.all(this.routeHandlers[topic].map(it => this.channel.cancel(it.consumerTag)));
        // remove whole topic
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
     * @param  {Object} opts  Publish options for RabbitMQ
     * @return {Promise}      Returns promise that can be awaited to ensure termination
     * @example
     * await microworkInstance.send('test.topic', 'test');
     * await microworkInstance.send('test.topic', {json: 'works too'});
     */
    async send(topic, data = '', opts = {}) {
        // wait for connection
        await this.connect();
        // send
        logger.debug('sending to', topic, 'data:', data);
        this.channel.publish(this.exchange, topic, new Buffer(JSON.stringify(data)), opts);
    }

    /**
     * Create subscription to given topic that will pass all incoming messages to given handler
     * @param  {string}   topic          Topic to subscribe to
     * @param  {Function} handler        Handler function that will get all incoming messages
     * @param  {Object}   queueConfig    Queue config to pass to RabbitMQ
     * @param  {Object}   consumeConfig  Consume config to pass to RabbitMQ
     * @param  {Object}   config         Config for subscriber (e.g. wether to auto-ack messages)
     * @return {string}                  Consumer tag that can be used for more precise unsubscribe action
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
     * }, {durable: true, autoDelete: true, exclusive: true});
     * @example <caption>Subscribe without auto-ack</caption>
     * await microworkInstance.subscribe('test.topic', (msg, reply, ack, nack) => {
     * 	if (msg === 'ping') {
     * 		ack();
     * 		reply('test.reply', 'pong');
     * 	} else {
     * 		nack();
     * 	}
     * }, {}, {}, {ack: false});
     */
    async subscribe(
        topic,
        handler,
        queueConfig = {},
        consumeConfig = {},
        config = {}
    ) {
        // merge queueConfig with defaults
        queueConfig = {
            durable: true,
            autoDelete: true,
            ...queueConfig,
        };
        // merge consumeConfig with defaults
        consumeConfig = {
            noAck: false,
            ...consumeConfig,
        };
        // merge config with defaults
        config = {
            ack: true,
            ...config,
        };
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
            if (config.ack) {
                this.channel.ack(data);
            }
            // pass to handler
            const reply = this.send.bind(this);
            const ack = this.channel.ack.bind(this.channel, data);
            const nack = this.channel.nack.bind(this.channel, data);
            handler(msg, reply, ack, nack);
        }, consumeConfig);
        // push to cleanup
        if (!this.routeHandlers[topic]) {
            this.routeHandlers[topic] = [];
        }
        this.routeHandlers[topic].push({
            queue,
            consumerTag,
        });
        logger.info('worker inited, consuming...');
        return consumerTag;
    }
}
