import { noop } from 'lodash';

export const nullLogger: ILogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

export interface ILogger extends IDebugLogger, IInfoLogger, IWarnLogger, IErrorLogger {
}

export interface IDebugLogger {
  debug(message?: any, ...optionalParams: any[]): void;
}

export interface IInfoLogger {
  info(message?: any, ...optionalParams: any[]): void;
}

export interface IWarnLogger {
  warn(message?: any, ...optionalParams: any[]): void;
}

export interface IErrorLogger {
  error(message?: any, ...optionalParams: any[]): void;
}
