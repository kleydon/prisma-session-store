import { PartialDeep } from 'type-fest';

export interface Options {
  ttl?:
    | number
    | ((
        options: Options,
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
  logger?:
    | {
        log: (message: string) => void;
        error: (message: string) => void;
      }
    | false;
}
