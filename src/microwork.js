// npm packages
const amqp = require('amqplib');
const uuid = require('uuid');
const winston = require('winston');
// our packages
const sleep = require('./sleep');
const createLogger = require('./logger');

/**
 * Core Microwork class that provides a way to create new microservice
 */
class Microwork {
  /**
   * Microwork class construct
   * @param  {object} opts                    Microwork instance options
   * @param  {string} opts.host               RabbitMQ host to use
   * @param  {string} opts.exchange           RabbitMQ exchange to use
   * @param  {Number} opts.reconnectTimeout   Timeout before trying to reconnect to RabbitMQ on failure
   * @return {void}
   * @example
   * const service = new Microwork({host: 'localhost', exchange: 'test.exchange'});
   */
  constructor({
    host = 'localhost',
    exchange = 'microwork.default.exchange',
    reconnectTimeout = 5000,
    loggingTransports,
  }) {
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
    /**
     * Reconnect timeout reference
     * @type {Number}
     * @private
     */
    this.reconnect = undefined;
    /**
     * Reconnect timeout timer stored for later usage
     * @type {Number}
     */
    this.reconnectTimeout = reconnectTimeout;
    // init logger
    this.initLogger(loggingTransports);
    // log
    this.logger.debug('construct with', host, exchange);
    // init connection
    this.connect().catch(this.tryReconnect.bind(this));
  }

  /**
   * Initialize logger with new options
   * @param  {Object} transports   Logger options, see winston.js for reference
   * @return {void}
   * @private
   */
  initLogger(transports = []) {
    if (transports.length === 0) {
      // only show info in production mode
      let level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
      // only show erros in test mode
      /* istanbul ignore if  */
      if (process.env.NODE_ENV === 'test') {
        level = 'error';
      }
      transports.push(new winston.transports.Console({
        level,
        colorize: true,
        label: `service-${this.id.slice(0, 8)}`,
      }));
    }
    /**
     * Logger
     * @private
     */
    this.logger = createLogger(transports);
  }

  tryReconnect(e) {
    if (e.code === 'ECONNREFUSED' && !this.reconnect) {
      this.logger.info(`Couldn't connect to rabbit, retrying in ${Math.floor(this.reconnectTimeout / 1000)}s...`);
      this.connecting = false;
      this.reconnect = setTimeout(() => {
        this.reconnect = undefined;
        this.connect(true).catch(this.tryReconnect.bind(this));
      }, this.reconnectTimeout);
      return;
    }
    this.logger.error('Error connecting:', e);
    throw e;
  }

  /**
   * Register new Microwork plugin
   * @param  {Object} plugin      Microwork plugin object
   * @return {void}
   * @example
   * const myMicroworkPlugin = require('my-microwork-plugin');
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
   * @param  {Boolean} calledFromTimer    Defines whether function was called from reconnect timer
   * @return {Promise}                    Returns promise that can be awaited to ensure connection
   * @private
   */
  async connect(calledFromTimer = false) {
    // if not called from timer and reconnect pending - return self after delay
    if (!calledFromTimer && this.reconnect) {
      return sleep(this.reconnectTimeout).then(() => this.connect());
    }
    // if connecting, wait a bit, then return self
    if (this.connecting) {
      return sleep(50).then(() => this.connect());
    }
    // do not do anything if already connected
    if (this.connection) {
      return true;
    }

    this.logger.silly('connecting...');
    // we're connecting
    this.connecting = true;
    // connect
    this.connection = await amqp.connect(`amqp://${this.host}`);
    this.logger.debug('connected to rabbit');
    // get two channels - receive and send
    this.channel = await this.connection.createChannel();
    this.logger.silly('got channels');
    // assing topic
    await this.channel.assertExchange(this.exchange, 'topic');
    this.logger.silly('got exchanges');
    // say we want to prefetch only 1 msg
    await this.channel.prefetch(1);
    this.logger.silly('prefetch set');
    // we're done connecting
    this.connecting = false;
    return true;
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
    if (!this.connection && this.reconnect) {
      this.logger.debug('not connected, cleaning reconnect timeout');
      clearTimeout(this.reconnect);
      return;
    }
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
    this.logger.debug('sending to', topic, 'data:', data);
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
   *  if (msg === 'ping') {
   *    reply('test.reply', 'pong');
   *  }
   * });
   * @example <caption>Subscribe with custom RabbitMQ options</caption>
   * await microworkInstance.subscribe('test.topic', (msg, reply) => {
   *  if (msg === 'ping') {
   *    reply('test.reply', 'pong');
   *  }
   * }, {durable: true, autoDelete: true, exclusive: true});
   * @example <caption>Subscribe without auto-ack</caption>
   * await microworkInstance.subscribe('test.topic', (msg, reply, ack, nack) => {
   *  if (msg === 'ping') {
   *    ack();
   *    reply('test.reply', 'pong');
   *  } else {
   *    nack();
   *  }
   * }, {}, {}, {ack: false});
   */
  async subscribe(
    topic,
    handler,
    userQueueConfig = {},
    userConsumeConfig = {},
    userConfig = {}
  ) {
    // merge queueConfig with defaults
    const queueConfig = Object.assign({
      durable: true,
      autoDelete: true,
    }, userQueueConfig);
    // merge consumeConfig with defaults
    const consumeConfig = Object.assign({
      noAck: false,
    }, userConsumeConfig);
    // merge config with defaults
    const config = Object.assign({
      ack: true,
    }, userConfig);
    // wait for connection
    await this.connect();
    // get queue
    this.logger.debug('adding worker for:', topic);
    const {queue} = await this.channel.assertQueue(`microwork-${topic}-queue`, queueConfig);
    await this.channel.bindQueue(queue, this.exchange, topic);
    this.logger.silly('bound queue...');
    // consume if needed
    this.logger.silly('initiating consuming...');
    // listen for messages
    const {consumerTag} = await this.channel.consume(queue, (data) => {
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
    this.logger.info('worker inited, consuming...');
    return consumerTag;
  }
}

module.exports = Microwork;
