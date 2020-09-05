import type { PartialDeep } from 'type-fest';
import { ILevel, ILogger } from './logger';
import { ISerializer } from './serializer';

export type TTLFactory = (
  options: IOptions,
  session: PartialDeep<Express.SessionData>,
  sid: string
) => number;

export interface IOptions {
  ttl?: number | TTLFactory;
  checkPeriod?: number;
  dbRecordIdIsSessionId?: boolean;
  dbRecordIdFunction?: Function;
  dispose?: Function;
  stale?: boolean;
  noDisposeOnSet?: boolean;
  serializer?: ISerializer;
  logger?: ILogger | false;
  loggerLevel?: ILevel | ILevel[];
}
