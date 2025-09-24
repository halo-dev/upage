import { Chalk } from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { DebugLevel } from '~/utils/logger';

const chalk = new Chalk({ level: 3 });

type LoggerFunction = (...messages: any[]) => void;

interface Logger {
  trace: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
  setLevel: (level: DebugLevel) => void;
}

let currentLevel: DebugLevel =
  (process.env.LOG_LEVEL as DebugLevel | undefined) || (import.meta.env.DEV ? 'debug' : 'info');

// 文件日志配置
const enableFileLogging = process.env.USAGE_LOG_FILE === 'true' || import.meta.env.DEV;
const logDir = path.join(process.cwd(), 'logs');

// 确保日志目录存在
if (enableFileLogging) {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (error) {
    console.error('Failed to create logs directory:', error);
  }
}

// 创建 Winston logger 实例
const winstonLogger = enableFileLogging
  ? winston.createLogger({
      level: currentLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf((info) => {
          const { timestamp, level, message, scope } = info;
          return `${timestamp} [${level.toUpperCase()}]${scope ? ` [${scope}]` : ''}: ${message}`;
        }),
      ),
      transports: [
        // 按日期分割的错误日志文件
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '10m', // 10MB
          maxFiles: 14, // 保留14天
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }) as winston.transport,
        // 所有级别日志
        new DailyRotateFile({
          filename: path.join(logDir, 'combined-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m', // 20MB
          maxFiles: 7, // 保留7天
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }) as winston.transport,
      ],
    })
  : null;

export const logger: Logger = {
  trace: (...messages: any[]) => log('trace', undefined, messages),
  debug: (...messages: any[]) => log('debug', undefined, messages),
  info: (...messages: any[]) => log('info', undefined, messages),
  warn: (...messages: any[]) => log('warn', undefined, messages),
  error: (...messages: any[]) => log('error', undefined, messages),
  setLevel,
};

export function createScopedLogger(scope: string): Logger {
  return {
    trace: (...messages: any[]) => log('trace', scope, messages),
    debug: (...messages: any[]) => log('debug', scope, messages),
    info: (...messages: any[]) => log('info', scope, messages),
    warn: (...messages: any[]) => log('warn', scope, messages),
    error: (...messages: any[]) => log('error', scope, messages),
    setLevel,
  };
}

function setLevel(level: DebugLevel) {
  if ((level === 'trace' || level === 'debug') && import.meta.env.PROD) {
    return;
  }

  currentLevel = level;

  // 更新 Winston logger 级别
  if (winstonLogger) {
    winstonLogger.level = level;
  }
}

function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  const levelOrder: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

  if (levelOrder.indexOf(level) < levelOrder.indexOf(currentLevel)) {
    return;
  }

  const allMessages = messages.reduce((acc, current) => {
    if (acc.endsWith('\n')) {
      return acc + current;
    }

    if (!acc) {
      return current;
    }

    return `${acc} ${current}`;
  }, '');

  const labelBackgroundColor = getColorForLevel(level);
  const labelTextColor = level === 'warn' ? '#000000' : '#FFFFFF';

  let labelText = formatText(` ${level.toUpperCase()} `, labelTextColor, labelBackgroundColor);

  if (scope) {
    labelText = `${labelText} ${formatText(` ${scope} `, '#FFFFFF', '77828D')}`;
  }

  // 控制台日志
  console.log(`${labelText}`, allMessages);

  // 写入文件日志
  if (winstonLogger) {
    try {
      winstonLogger.log({
        level,
        message: allMessages,
        scope,
      });
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}

function formatText(text: string, color: string, bg: string) {
  return chalk.bgHex(bg)(chalk.hex(color)(text));
}

function getColorForLevel(level: DebugLevel): string {
  switch (level) {
    case 'trace':
    case 'debug': {
      return '#77828D';
    }
    case 'info': {
      return '#1389FD';
    }
    case 'warn': {
      return '#FFDB6C';
    }
    case 'error': {
      return '#EE4744';
    }
    default: {
      return '#000000';
    }
  }
}

export const renderLogger = createScopedLogger('Render');
