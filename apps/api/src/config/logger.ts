import { env } from './env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  // Structured JSON logs; human-readable only in development console.
  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    env: env.NODE_ENV,
    ...fields,
  };
  if (level === 'error' || level === 'warn') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => {
    if (env.NODE_ENV !== 'production') log('debug', msg, fields);
  },
  info: (msg: string, fields?: Record<string, unknown>) => log('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => log('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => log('error', msg, fields),
};
