const os = require('os');

/**
 * Hardware stats plugin
 * @type {Object}
 */
const HardwareStat = {
  /**
   * Reference to hardware autoreport interval
   * @type {Number}
   * @private
   */
  hardwareReportIntervalRef: null,
  /**
   * Interval to send hardware report messages
   * @type {Number}
   */
  hardwareReportInterval: 60000,

  /**
   * Gets CPU stats
   * @return {Object} CPU stats (number of CPUs and average load)
   * @private
   */
  cpuStat() {
    const cpus = os.cpus(); // get cores count
    const load = os.loadavg(); // get average
    return {
      cpus: cpus.length,
      load,
    };
  },

  /**
   * Gets memory stats
   * @return {Object} Memory stats (used, free, total mem in bytes)
   * @private
   */
  memStat() {
    const total = os.totalmem();
    const free = os.freemem();
    return {
      used: total - free,
      free,
      total,
    };
  },

  /**
   * Gets all hardware stats
   * @return {Object} Hardware stats
   * @private
   */
  hwStat() {
    return {
      cpu: this.cpuStat(),
      mem: this.memStat(),
    };
  },

  /**
   * Sends hardware report message
   * @return {void}
   */
  reportHardwareStats() {
    this.send('microwork.node.status', this.hwStat(), {expiration: this.hardwareReportInterval});
  },

  /**
   * Inits autoreport of hardware stats, will dispatch messages using given interval
   * @return {void}
   */
  autoreportHardwareStats() {
    this.stopAutoreportHardwareStats();
    this.hardwareReportIntervalRef = setInterval(() => this.reportHardwareStats(), this.hardwareReportInterval);
  },

  /**
   * Stops autoreporting hardware stats
   * @return {void}
   */
  stopAutoreportHardwareStats() {
    if (this.hardwareReportIntervalRef) {
      clearInterval(this.hardwareReportIntervalRef);
      delete this.hardwareReportIntervalRef;
    }
  },
};

module.exports = HardwareStat;
