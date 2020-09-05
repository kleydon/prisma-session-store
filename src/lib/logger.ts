import { ILevel, ILogger } from '../@types/logger';

/**
 * A object that handles logging to a given logger based on the logging level
 */
export class ManagedLogger {
  /**
   * Creates a ManagedLogger that will log only at given severity levels
   * @param logger a logger where logs will be logged to. If set
   * to false then logging is disabled
   * @param level The level(s) of severity to log
   */
  constructor(
    private readonly logger: ILogger | false,
    private readonly level: ILevel | ILevel[]
  ) {}

  /**
   * Check if logging is enabled for a given severity level
   * @param level The level to check if logging is enabled for
   */
  private checkLevel(level: ILevel): boolean {
    if (Array.isArray(this.level)) return this.level.includes(level);
    else return this.level === level;
  }

  /**
   * Logs out information via the logger if the `log` level is enabled
   * @param message the message to log
   */
  public log(message: string): void {
    if (this.logger && this.checkLevel('log')) this.logger.log?.(message);
  }

  /**
   * Logs out warnings via the logger if the `warn` level is enabled
   * @param message the message to log
   */
  public warn(message: string): void {
    if (this.logger && this.checkLevel('warn')) this.logger.warn?.(message);
  }

  /**
   * Logs out errors via the logger if the `error` level is enabled
   * @param error the error to log
   */
  public error(error: unknown): void {
    if (this.logger && this.checkLevel('error')) this.logger.error?.(error);
  }
}
