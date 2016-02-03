const HealthCheck = {
    healthchecksReportIntervalRef: null,
    healthchecksReportInterval: 30000,

    reportHealth() {
        this.send('microwok.node.alive', this.id, {expiration: this.healthchecksReportInterval});
    },

    autoreportHealth() {
        this.stopAutoreportHealth();
        this.healthchecksReportIntervalRef = setInterval(() => this.reportHealth(), this.healthchecksReportInterval);
    },

    stopAutoreportHealth() {
        if (this.healthchecksReportIntervalRef) {
            clearInterval(this.healthchecksReportIntervalRef);
            delete this.healthchecksReportIntervalRef;
        }
    },
};

export default HealthCheck;
