import type { PartialDeep } from 'type-fest';
import { ILevel, ILogger } from './logger';
import { ISerializer } from './serializer';

/**
 * A function that takes in the `PrismaSessionStore` options, the `SessionData`
 * and the `sid` for a given session and returns the TTL (time to live) in milliseconds
 * for that particular session.
 */
export type TTLFactory = (
  options: IOptions,
  session: PartialDeep<Express.SessionData>,
  sid: string
) => number;

/**
 * PrismaSessionStore options to alter the way the store behaves
 */
export interface IOptions {
  /**
   * "Time to live", in ms;
   * defines session expiration time. Defaults to session.maxAge (if set), or
   * one day (if not set). May alternatively be set to a function, of the form
   * `(options, session, sid) => number`.
   */
  ttl?: number | TTLFactory;

  /**
   * Interval, in ms, at which PrismaSessionStore will automatically remove
   * expired sessions. Disabled by default; set to something reasonable.
   */
  checkPeriod?: number;

  /**
   * A flag indicating to use the session ID as the Prisma Record ID
   *
   * Note: If undefined and dbRecordIdFunction is also undefined then a random
   * CUID will be used instead.
   */
  dbRecordIdIsSessionId?: boolean;

  /**
   * A function to generate the Prisma Record ID for a given session ID
   *
   * Note: If undefined and dbRecordIdIsSessionId is also undefined then a random
   * CUID will be used instead.
   */
  dbRecordIdFunction?: (sessionID: string) => string;

  /**
   * Called on sessions when they are dropped. Handy if you want to close file descriptors
   * or do other cleanup tasks when sessions are no longer accessible. Called with `key, value`.
   * It's called _before_ actually removing the item from the internal cache, so if you want
   * to immediately put it back in, you'll have to do that in a `nextTick` or `setTimeout`
   * callback or it won't do anything.
   */
  dispose?: Function;

  /**
   * By default, if you set a `maxAge`, it'll only actually pull stale
   * items out of the cache when you `get(key)`. (That is, it's not
   * pre-emptively doing a `setTimeout` or anything.) If you set
   * `stale:true`, it'll return the stale value before deleting it.
   * If you don't set this, then it'll return `undefined` when you
   * try to get a stale entry, as if it had already been deleted.
   */
  stale?: boolean;

  /**
   * By default, if you set a `dispose()` method, then it'll be called
   * whenever a `set()` operation overwrites an existing key. If you set
   * this option, `dispose()` will only be called when a key falls out
   * of the cache, not when it is overwritten.
   */
  noDisposeOnSet?: boolean;

  /**
   * An object containing `stringify` and `parse` methods compatible with
   * Javascript `JSON` to override the serializer used.
   */
  serializer?: ISerializer;

  /**
   * Where logs should be outputted to, by default `console`
   * If set to `false` then logging will be disabled
   */
  logger?: ILogger | false;

  /**
   * Determines which logging methods to enable, by default `error` only
   */
  loggerLevel?: ILevel | ILevel[];
}
