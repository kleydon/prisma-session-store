import cuid from 'cuid';
import { SessionData, Store } from 'express-session';
import { dedent } from 'ts-dedent';
import type { PartialDeep } from 'type-fest';

import type { IOptions, IPrisma, ISessions } from '../@types';

import { ManagedLogger } from './logger';
import { createExpiration, defer, getTTL } from './utils';

/**
 * An `express-session` store used in the `express-session` options
 * to hook up prisma as a session store
 *
 * @example
 * ```ts
 * const app = express();
 * const prisma = new PrismaClient();
 *
 * app.use(
 *   expressSession({
 *     secret: "Some Secret Value",
 *     resave: false,
 *     saveUninitialized: false,
 *     store: new PrismaSessionStore(prisma, {
 *       checkPeriod: 10 * 60 * 1000 // 10 minutes
 *     });
 *   })
 * );
 * ```
 */
export class PrismaSessionStore<M extends string = 'session'> extends Store {
  /**
   * Initialize PrismaSessionStore with the given `prisma` and (optional) `options`.
   *
   * @param prisma the prisma client that includes a `Sessions` model
   * @param options the options to alter how this store behaves
   *
   * @example
   * ```ts
   * const app = express();
   * const prisma = new PrismaClient();
   *
   * app.use(
   *   expressSession({
   *     secret: "Some Secret Value",
   *     resave: false,
   *     saveUninitialized: false,
   *     store: new PrismaSessionStore(prisma, {
   *       checkPeriod: 10 * 60 * 1000 // 10 minutes
   *     });
   *   })
   * );
   * ```
   */
  constructor(
    private readonly prisma: IPrisma<M>,
    private readonly options: IOptions<M>
  ) {
    super();
    this.startInterval();
    this.connect();
  }

  /**
   * @description The currently active interval created with `startInterval()` and removed with `stopInterval()`
   */
  private checkInterval?: NodeJS.Timeout;

  /**
   * @description A flag indicating to use the session ID as the Prisma Record ID
   *
   * Note: If undefined and dbRecordIdFunction is also undefined then a random
   * CUID will be used instead.
   */
  private readonly dbRecordIdIsSessionId = this.options.dbRecordIdIsSessionId;

  /**
   * @description whether or not the prisma connection has been tested to be invalid
   */
  private invalidConnection = false;

  /**
   * @description A object that handles logging to a given logger based on the logging level
   */
  private readonly logger = new ManagedLogger(
    this.options.logger ?? console,
    this.options.loggerLevel ?? ['error']
  );

  /**
   * @description Some serializer that will transform objects into strings
   * and vice versa
   */
  private readonly serializer = this.options.serializer ?? JSON;

  /**
   * @description The name of the sessions model
   *
   * Defaults to `session` if `sessionModelName` in options is undefined
   */
  private readonly sessionModelName: Exclude<M, `$${string}`> =
    this.options.sessionModelName ?? ('session' as Exclude<M, `$${string}`>);

  /**
   * Attempts to connect to Prisma, displaying a pretty error if the connection is not possible.
   */
  private async connect(): Promise<void> {
    await this.prisma?.$connect?.();
    await this.validateConnection();
  }

  /**
   * @description A function to generate the Prisma Record ID for a given session ID
   *
   * Note: If undefined and dbRecordIdIsSessionId is also undefined then a random
   * CUID will be used instead.
   */
  private readonly dbRecordIdFunction = (sid: string) =>
    this.options.dbRecordIdFunction?.(sid) ?? cuid();

  /**
   * Disables store, used when prisma cannot be connected to
   */
  private disable(): void {
    this.invalidConnection = true;
  }

  /**
   * Returns if the connect is valid or not, logging an error if it is not.
   */
  private async validateConnection(): Promise<boolean> {
    await (
      this.prisma?.$connect?.() ??
      Promise.reject(new Error('Could not connect'))
    ).catch(() => {
      this.disable();
      this.stopInterval();
      this.logger.error(dedent`Could not connect to Sessions model in Prisma.
      Please make sure that prisma is setup correctly and that your migrations are current.
      For more information check out https://github.com/kleydon/prisma-session-store`);
    });

    return !this.invalidConnection;
  }

  /**
   * Fetch all sessions
   *
   * @param callback a callback providing all session data
   * or an error that occurred
   */
  public readonly all = async (
    callback?: (err?: unknown, all?: ISessions) => void
  ) => {
    if (!(await this.validateConnection())) return callback?.();

    try {
      const sessions = await this.prisma[this.sessionModelName].findMany({
        select: { sid: true, data: true },
      });

      const result = sessions
        .map(
          ({ sid, data }) =>
            [sid, this.serializer.parse(data ?? '{}') as SessionData] as const
        )
        .reduce<ISessions>(
          (prev, [sid, data]) => ({ ...prev, [sid]: data }),
          {}
        );

      if (callback) defer(callback, undefined, result);

      return result;
    } catch (e: unknown) {
      this.logger.error(`all(): ${String(e)}`);
      if (callback) defer(callback, e);
    }
  };

  /**
   * Delete all sessions from the store
   *
   * @param callback a callback notifying that all sessions
   * were deleted or that an error occurred
   */
  public readonly clear = async (callback?: (err?: unknown) => void) => {
    if (!(await this.validateConnection())) return callback?.();

    try {
      await this.prisma[this.sessionModelName].deleteMany();

      if (callback) defer(callback);
    } catch (e: unknown) {
      if (callback) defer(callback, e);
    }
  };

  /**
   * Destroy the session(s) associated with the given `sid`(s).
   *
   * @param sid a single or multiple id(s) to remove data for
   * @param callback a callback notifying that the session(s) have
   * been destroyed or that an error occurred
   */
  public readonly destroy = async (
    sid: string | string[],
    callback?: (err?: unknown) => void
  ) => {
    if (!(await this.validateConnection())) return callback?.();

    try {
      if (Array.isArray(sid)) {
        await Promise.all(sid.map(async (id) => this.destroy(id, callback)));
      } else {
        await this.prisma[this.sessionModelName].delete({ where: { sid } });
      }
    } catch (e: unknown) {
      // NOTE: Attempts to delete non-existent sessions land here
      if (callback) defer(callback, e);

      return;
    }

    if (callback) defer(callback);
  };

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param sid the sid to attempt to fetch
   * @param callback a function to call with the results
   */
  public readonly get = async (
    sid: string,
    callback?: (err?: unknown, val?: SessionData) => void
  ) => {
    if (!(await this.validateConnection())) return callback?.();
    const session = await this.prisma[this.sessionModelName]
      .findUnique({
        where: { sid },
      })
      .catch(() => null);

    if (session === null) return callback?.();

    try {
      const result = this.serializer.parse(session.data ?? '{}') as SessionData;
      if (callback) defer(callback, undefined, result);

      return result;
    } catch (e: unknown) {
      this.logger.error(`get(): ${String(e)}`);
      if (callback) defer(callback, e);
    }
  };

  /**
   * Fetch all sessions' ids
   *
   * @param callback a callback providing all session id
   * or an error that occurred
   */
  public readonly ids = async (
    callback?: (err?: unknown, ids?: number[]) => void
  ) => {
    if (!(await this.validateConnection())) return callback?.();

    // XXX More efficient way? XXX

    try {
      const sessions = await this.prisma[this.sessionModelName].findMany({
        select: { sid: true },
      });

      const sids = sessions.map(({ sid }) => sid);
      if (callback) defer(callback, undefined, sids);

      return sids;
    } catch (e: unknown) {
      if (callback) defer(callback, e);
    }
  };

  /**
   * Get the count of all sessions in the store
   *
   * @param callback a callback providing either the number of sessions
   * or an error that occurred
   */
  public readonly length = async (
    callback?: (err: unknown, length: number) => void
  ) => {
    if (!(await this.validateConnection()))
      return callback?.(new Error('Could not connect'), 0);

    // XXX More efficient way? XXX

    try {
      const sessions = await this.prisma[this.sessionModelName].findMany({
        select: { sid: true }, // Limit what gets sent back; can't be empty.
      });

      const itemCount = sessions.length;
      if (callback) defer(callback, undefined, itemCount);

      return itemCount;
    } catch (e: unknown) {
      if (callback) defer(callback, e);
    }
  };

  /**
   * Remove only expired entries from the store
   */

  public readonly prune = async () => {
    if (!(await this.validateConnection())) return;

    // XXX More efficient way? Maybe when filtering is fully implemented? XXX

    this.logger.log('Checking for any expired sessions...');
    const sessions = await this.prisma[this.sessionModelName].findMany({
      select: {
        expiresAt: true,
        sid: true,
      },
    });

    for (const session of sessions) {
      const p = this.prisma[this.sessionModelName];
      const now = new Date();
      const remainingSec = (session.expiresAt.valueOf() - now.valueOf()) / 1000;
      this.logger.log(`session:${session.sid} expires in ${remainingSec}sec`);
      if (now.valueOf() >= session.expiresAt.valueOf()) {
        const sid = session.sid;
        this.logger.log(`Deleting session with sid: ${sid}`);
        const foundSession = await p.findUnique({ where: { sid } });
        if (foundSession !== null) await p.delete({ where: { sid } });
      }
    }
  };

  /**
   * Commit the given `session` object associated with the given `sid`.
   *
   * @param sid the ID to save the session data under
   * @param session the session data to save
   * @param callback a callback with the results of saving the data
   * or an error that occurred
   */
  public readonly set = async (
    sid: string,
    session: PartialDeep<SessionData>,
    callback?: (err?: unknown) => void
  ) => {
    if (!(await this.validateConnection())) return callback?.();

    const ttl = getTTL(this.options, session, sid);
    const expiresAt = createExpiration(ttl, {
      rounding: this.options.roundTTL,
    });

    let sessionString;
    try {
      sessionString = this.serializer.stringify(session);
    } catch (e: unknown) {
      this.logger.error(`set(): ${String(e)}`);
      if (callback) defer(callback, e);

      return;
    }

    const existingSession = await this.prisma[this.sessionModelName]
      .findUnique({
        where: { sid },
      })
      .catch(() => null);

    const data = {
      sid,
      expiresAt,
      data: sessionString,
    };

    try {
      if (existingSession !== null) {
        await this.prisma[this.sessionModelName].update({
          data,
          where: { sid },
        });
      } else {
        await this.prisma[this.sessionModelName].create({
          data: {
            ...data,
            id: this.dbRecordIdIsSessionId ? sid : this.dbRecordIdFunction(sid),
            data: sessionString,
          },
        });
      }
    } catch (e: unknown) {
      this.logger.error(`set(): ${String(e)}`);
      if (callback) defer(callback, e);

      return;
    }

    if (callback) defer(callback);
  };

  /**
   * A function to stop any ongoing intervals and disconnect from the `PrismaClient`
   */
  public async shutdown(): Promise<void> {
    this.stopInterval();
    await this.prisma.$disconnect();
  }

  /**
   * Start an interval to prune expired sessions
   */
  public startInterval(onIntervalError?: (err: unknown) => void): void {
    const ms = this.options.checkPeriod;
    if (typeof ms === 'number' && ms !== 0) {
      this.stopInterval();
      this.checkInterval = setInterval(async () => {
        try {
          await this.prune();
        } catch (err: unknown) {
          if (onIntervalError !== undefined) onIntervalError(err);
        }
      }, Math.floor(ms));
    }
  }

  /**
   * Stop checking if sessions have expired
   */
  public stopInterval(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

  /**
   * Refresh the time-to-live for the session with the given `sid`.
   *
   * @param sid the id of the session to refresh
   * @param session the data of the session to resave
   * @param callback a callback notifying that the refresh was completed
   * or that an error occurred
   */
  public readonly touch = async (
    sid: string,
    session: PartialDeep<SessionData>,
    callback?: (err?: unknown) => void
  ) => {
    if (!(await this.validateConnection())) return callback?.();

    const ttl = getTTL(this.options, session, sid);
    const expiresAt = createExpiration(ttl, {
      rounding: this.options.roundTTL,
    });

    try {
      const existingSession = await this.prisma[
        this.sessionModelName
      ].findUnique({
        where: { sid },
      });

      if (existingSession !== null) {
        const existingSessionData = {
          ...this.serializer.parse(existingSession.data ?? '{}'),
          cookie: session.cookie,
        };

        await this.prisma[this.sessionModelName].update({
          where: { sid: existingSession.sid },
          data: {
            expiresAt,
            data: this.serializer.stringify(existingSessionData),
          },
        });
      }

      // *** If there is no found session, for some reason, should it be recreated from sess *** ?
      if (callback) defer(callback);
    } catch (e: unknown) {
      this.logger.error(`touch(): ${String(e)}`);
      if (callback) defer(callback, e);
    }
  };
}
