import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  requestId?: string;
  service?: string;
  userId?: string;
  [key: string]: any;
}

export class Logger {
  private logger: winston.Logger;
  private defaultMeta: LogContext;

  constructor(service: string, defaultMeta: LogContext = {}) {
    this.defaultMeta = { service, ...defaultMeta };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: this.defaultMeta,
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/combined.log'
        })
      ]
    });
  }

  info(message: string, meta?: LogContext) {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: LogContext) {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: LogContext) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: LogContext) {
    this.logger.debug(message, meta);
  }

  // Request-scoped logger
  withRequest(requestId: string): Logger {
    return new Logger(this.defaultMeta.service || 'unknown', {
      ...this.defaultMeta,
      requestId
    });
  }
}

// Singleton instance for quick access
export const logger = new Logger('common');
