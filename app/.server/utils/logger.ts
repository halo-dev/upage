import { Chalk } from 'chalk';
import type { DebugLevel } from '~/types/global';

export type { DebugLevel };

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

let winstonLogger: any = null;
let winstonInitialized = false;

async function initializeWinston() {
  if (winstonInitialized) {
    return;
  }

  winstonInitialized = true;

  try {
    const fs = await import('fs');
    const path = await import('path');
    const winston = await import('winston');
    const { default: DailyRotateFile } = await import('winston-daily-rotate-file');

    const enableFileLogging = process.env.USAGE_LOG_FILE !== 'false';

    if (!enableFileLogging) {
      return;
    }

    const logDir = path.join(process.cwd(), 'logs');

    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
      return;
    }

    winstonLogger = winston.createLogger({
      level: currentLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf((info) => {
          const { timestamp, level, message, scope } = info;
          return `${timestamp} [${level.toUpperCase()}]${scope ? ` [${scope}]` : ''}: ${message}`;
        }),
      ),
      transports: [
        // Error log file split by date
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '10m', // 10 MB
          maxFiles: 14, // Keep 14 days
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }) as any,
        // All levels log
        new DailyRotateFile({
          filename: path.join(logDir, 'combined-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m', // 20 MB
          maxFiles: 7, // Keep 7 days
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }) as any,
      ],
    });
  } catch (error) {
    console.error('Failed to initialize Winston logger:', error);
  }
}

initializeWinston();

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

  // Update Winston logger level
  if (winstonLogger) {
    winstonLogger.level = level;
  }
}

function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  const levelOrder: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

  if (levelOrder.indexOf(level) < levelOrder.indexOf(currentLevel)) {
    return;
  }

  const labelBackgroundColor = getColorForLevel(level);
  const labelTextColor = level === 'warn' ? '#000000' : '#FFFFFF';

  // Format objects as JSON strings
  const formattedMessages = messages.map((msg) => {
    if (typeof msg === 'object' && msg !== null) {
      try {
        return JSON.stringify(msg, null, 2);
      } catch {
        return String(msg);
      }
    }
    return msg;
  });

  const allMessages = formattedMessages.reduce((acc, current) => {
    if (acc.endsWith('\n')) {
      return acc + current;
    }

    if (!acc) {
      return current;
    }

    return `${acc} ${current}`;
  }, '');

  let labelText = formatText(` ${level.toUpperCase()} `, labelTextColor, labelBackgroundColor);

  if (scope) {
    labelText = `${labelText} ${formatText(` ${scope} `, '#FFFFFF', '77828D')}`;
  }

  console.log(`${labelText}`, allMessages);

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
