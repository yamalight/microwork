const winston = require('winston');

const newLogger = transports => new winston.Logger({transports});

module.exports = newLogger;
