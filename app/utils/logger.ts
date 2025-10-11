export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

import { Chalk } from 'chalk';

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

const isServer = typeof window === 'undefined';

let currentLevel: DebugLevel =
  (process.env.LOG_LEVEL as DebugLevel | undefined) || (import.meta.env.DEV ? 'debug' : 'info');

let winstonLogger: any = null;
let winstonInitialized = false;

async function initializeWinston() {
  if (!isServer || winstonInitialized) {
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
        // 按日期分割的错误日志文件
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '10m', // 10MB
          maxFiles: 14, // 保留14天
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }) as any,
        // 所有级别日志
        new DailyRotateFile({
          filename: path.join(logDir, 'combined-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m', // 20MB
          maxFiles: 7, // 保留7天
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }) as any,
      ],
    });
  } catch (error) {
    console.error('Failed to initialize Winston logger:', error);
  }
}

if (isServer) {
  initializeWinston();
}

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

  const labelBackgroundColor = getColorForLevel(level);
  const labelTextColor = level === 'warn' ? '#000000' : '#FFFFFF';

  // 控制台日志 - 根据环境使用不同格式
  if (typeof window !== 'undefined') {
    // 浏览器环境 - 保持对象原样，利用浏览器的原生格式化
    const labelStyles = getLabelStyles(labelBackgroundColor, labelTextColor);
    const scopeStyles = getLabelStyles('#77828D', 'white');

    const styles = [labelStyles];

    if (typeof scope === 'string') {
      styles.push('', scopeStyles);
    }

    // 直接传递原始消息，浏览器会自动格式化对象
    console.log(`%c${level.toUpperCase()}${scope ? `%c %c${scope}` : ''}`, ...styles, ...messages);
  } else {
    // Node.js 环境 - 将对象格式化为 JSON 字符串
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

    // 写入文件日志（仅服务端）
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
}

function formatText(text: string, color: string, bg: string) {
  return chalk.bgHex(bg)(chalk.hex(color)(text));
}

function getLabelStyles(color: string, textColor: string) {
  return `background-color: ${color}; color: white; border: 4px solid ${color}; color: ${textColor};`;
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
