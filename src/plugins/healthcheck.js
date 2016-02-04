/**
 * Health check plugin
 * @type {Object}
 */
const HealthCheck = {
    /**
     * Reference to autoreport interval
     * @type {Number}
     * @private
     */
    healthchecksReportIntervalRef: null,
    /**
     * Interval to send keep-alive messages
     * @type {Number}
     */
    healthchecksReportInterval: 30000,

    /**
     * Sends keep-alive message
     * @return {void}
     */
    reportHealth() {
        this.send('microwork.node.alive', this.id, {expiration: this.healthchecksReportInterval});
    },

    /**
     * Inits autoreport of health, will dispatch keep-alive messages using given interval
     * @return {void}
     */
    autoreportHealth() {
        this.stopAutoreportHealth();
        this.healthchecksReportIntervalRef = setInterval(() => this.reportHealth(), this.healthchecksReportInterval);
    },

    /**
     * Stops autoreporting health
     * @return {void}
     */
    stopAutoreportHealth() {
        if (this.healthchecksReportIntervalRef) {
            clearInterval(this.healthchecksReportIntervalRef);
            delete this.healthchecksReportIntervalRef;
        }
    },
};

export default HealthCheck;
