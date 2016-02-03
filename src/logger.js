import winston from 'winston';

// only show info in production mode
let level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
// only show erros in test mode
if (process.env.NODE_ENV === 'test') {
    level = 'error';
}
// init logger
const logger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level,
            colorize: true,
            timestamp: true,
            label: 'microwork',
        }),
    ],
});

export default logger;
