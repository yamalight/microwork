import os from 'os';

const HardwareStat = {
    hardwareReportIntervalRef: null,
    hardwareReportInterval: 60000,

    cpuStat() {
        const cpus = os.cpus(); // get cores count
        const load = os.loadavg(); // get average
        return {
            cpus: cpus.length,
            load,
        };
    },

    memStat() {
        const total = os.totalmem();
        const free = os.freemem();
        return {
            used: total - free,
            free,
            total,
        };
    },

    hwStat() {
        return {
            cpu: this.cpuStat(),
            mem: this.memStat(),
        };
    },

    reportHardwareStats() {
        this.send('microwork.node.status', this.hwStat(), {expiration: this.hardwareReportInterval});
    },

    autoreportHardwareStats() {
        this.stopAutoreportHardwareStats();
        this.hardwareReportIntervalRef = setInterval(() => this.reportHardwareStats(), this.hardwareReportInterval);
    },

    stopAutoreportHardwareStats() {
        if (this.hardwareReportIntervalRef) {
            clearInterval(this.hardwareReportIntervalRef);
            delete this.hardwareReportIntervalRef;
        }
    },
};

export default HardwareStat;
