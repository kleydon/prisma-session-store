/**
 * A logger of some sort that will be used to log out warnings, errors
 * and information based on the enabled level(s)
 */
export interface ILogger {
  /**
   * A function that logs general information
   */
  log?: (message?: string) => void;

  /**
   * A function that logs warnings
   */
  warn?: (message?: string) => void;

  /**
   * A function that logs error messages
   */
  error?: (error?: unknown) => void;
}

/**
 * Which logging methods are enabled
 */
export type ILevel = 'log' | 'warn' | 'error';
