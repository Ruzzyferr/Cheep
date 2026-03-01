import winston from 'winston';

// Log formatını belirliyoruz.
const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }), // Hata durumunda stack trace'i logla
        logFormat
    ),
    transports: [
        // Geliştirme ortamında logları renklendirerek konsola basalım.
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        // İleride logları bir dosyaya kaydetmek isterseniz aşağıdaki satırları açabilirsiniz.
        // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        // new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

export default logger;