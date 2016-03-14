import winston from 'winston';

export default (opts) => new winston.Logger({
    transports: [
        new winston.transports.Console(opts),
    ],
});
