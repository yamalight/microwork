const SubscriberStats = {
    subscriberStatsExpiration: 60000,

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

    initSubscribersReporting() {
        this.subscribe('microwork.node.report.subscribers', () => this.reportSubscribers());
    },
};

export default SubscriberStats;
