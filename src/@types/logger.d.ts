export interface ILogger {
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (error: unknown) => void;
}

export type ILevel = 'log' | 'warn' | 'error';
