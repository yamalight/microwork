/**
 * Subscriber stats plugin
 * @type {Object}
 */
const SubscriberStats = {
    /**
     * Expiration time for subscribers stat message for RabbitMQ
     * @type {Number}
     */
    subscriberStatsExpiration: 60000,

    /**
     * Creates and sends report on current subscribers to RabbitMQ
     * @return {[type]} [description]
     */
    reportSubscribers() {
        const subscribers = Object.keys(this.routeHandlers)
            .map(key => ({
                topic: key,
                subscribers: this.routeHandlers[key].length,
            }));
        const stat = {
            id: this.id,
            subscribers,
        };
        this.send('microwork.node.subscribers', stat, {expiration: this.subscriberStatsExpiration});
    },

    /**
     * Initializes listener for requests for subscribers stats
     * @return {void}
     */
    initSubscribersReporting() {
        this.subscribe('microwork.node.report.subscribers', () => this.reportSubscribers());
    },
};

export default SubscriberStats;
