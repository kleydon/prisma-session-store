import { ILevel, ILogger } from '../@types/logger';

export class Logger {
  constructor(
    private readonly logger: ILogger | false,
    private readonly level: ILevel | ILevel[]
  ) {}

  private checkLevel(level: ILevel): boolean {
    if (Array.isArray(this.level)) return this.level.includes(level);
    else return this.level === level;
  }

  public log(message: string): void {
    if (this.logger && this.checkLevel('log')) this.logger.log?.(message);
  }

  public warn(message: string): void {
    if (this.logger && this.checkLevel('warn')) this.logger.warn?.(message);
  }

  public error(error: unknown): void {
    if (this.logger && this.checkLevel('error')) this.logger.error?.(error);
  }
}
