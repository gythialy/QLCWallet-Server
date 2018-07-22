import {
    createLogger,
    format as _format,
    transports as _transports
} from 'winston';

var logger = createLogger({
    level: 'info',
    format: _format.combine(
        _format.timestamp(),
        _format.colorize(),
        _format.splat(),
        _format.simple(),
        _format.printf(info => {
            return `${info.timestamp} ${info.level}: ${info.message}`;
        })
    ),
    transports: [
        new _transports.File({
            filename: '/var/log/wallet-server/error.log',
            level: 'error',
            maxFiles: 10,
            maxsize: 5242880 // 5M
        }),
        new _transports.File({
            filename: '/var/log/wallet-server/combined.log',
            maxsize: 5242880, //5M
            maxFiles: 20,
        })
    ],
    exceptionHandlers: [
        new _transports.File({
            filename: '/var/log/wallet-server/exceptions.log'
        })
    ],
    exitOnError: false
});


if (process.env.NODE_ENV !== 'production') {
    logger.add(new _transports.Console({
        level: 'debug',
        colorize: true,
    }));
}

export {
    logger
}