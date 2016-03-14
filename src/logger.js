import winston from 'winston';

export default (transports) => new winston.Logger({transports});
