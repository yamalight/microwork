import winston from 'winston';

const Logger = (tag, level = process.env.NODE_ENV === 'production' ? 'info' : 'debug') => {
    // only show erros in test mode
    if (process.env.NODE_ENV === 'test') {
        level = 'error';
    }
    return new winston.Logger({
        transports: [
            new winston.transports.Console({
                level,
                colorize: true,
                timestamp: true,
                label: 'microwork-' + tag,
            }),
        ],
    });
};

export default Logger;
