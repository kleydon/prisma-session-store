import { PartialDeep } from 'type-fest';
import { ILevel, ILogger } from './logger';

export interface IOptions {
  ttl?:
    | number
    | ((
        options: IOptions,
        sess: PartialDeep<Express.SessionData>,
        sid: string
      ) => number);
  checkPeriod?: number;
  dbRecordIdIsSessionId?: boolean;
  dbRecordIdFunction?: Function;
  dispose?: Function;
  stale?: boolean;
  noDisposeOnSet?: boolean;
  serializer?: {
    parse: (string: string) => object;
    stringify: (object: object) => string;
  };
  logger?: ILogger | false;
  loggerLevel?: ILevel | ILevel[];
}
