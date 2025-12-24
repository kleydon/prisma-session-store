import cuid2 from '@paralleldrive/cuid2';
import { SessionData, Store } from 'express-session';
import { dedent } from 'ts-dedent';
import type { PartialDeep } from 'type-fest';

import type { IOptions, IPrisma, ISessions } from '../@types';

import { ManagedLogger } from './logger';
import { createExpiration, defer, getTTL } from './utils';
import { ISerializer } from '../@types/serializer';

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

    this.isSetting = new Map<string, boolean>();
    this.isTouching = new Map<string, boolean>();

    this.dbRecordIdIsSessionId = this.options.dbRecordIdIsSessionId;
    this.logger = new ManagedLogger(
      this.options.logger ?? console,
      this.options.loggerLevel ?? ['error']
    );
    this.serializer = this.options.serializer ?? JSON;
    this.sessionModelName =
      this.options.sessionModelName ?? ('session' as Exclude<M, `$${string}`>);

    this.startInterval();
    this.connect();
  }

  // Work-around, re: concurrrent calls to touch() and concurrent calls to set()
  // having the same session id:
  // Some users have experienced issues when concurrent calls are made
  // to touch() or set(), using the same session id.
  // This can occur, for instance, when a browser is loading
  // a page with multiple resources in parallel.
  // The issue may simply be an issue with SQLite
  // (see https://stackoverflow.com/questions/4060772/sqlite-concurrent-access),
  // but it hasn't yet been isolated. It is possible that express-session or prisma
  // are alternately / additionally implicated.
  //
  // Until there is a long-term solution, this library offers a work-around,
  // wherein only a single invocation of set() (or touch()) for a given session id
  // may be executed at a time.
  //
  // If necessary, this workaround may be disabled by setting the following
  // PrismaSessionStore options to true:
  //   * enableConcurrentSetInvocationsForSameSessionID
  //   * enableConcurrentTouchInvocationsForSameSessionID
  //
  // Use of the variables isTouching and isSetting (below)
  // enables this work-around, and all references to these
  // may be removed once the work-around is no longer needed.
  private readonly isTouching: Map<string, boolean>;
  private readonly isSetting: Map<string, boolean>;

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
  private readonly dbRecordIdIsSessionId: boolean | undefined;

  /**
   * @description whether or not the prisma connection has been tested to be invalid
   */
  private invalidConnection = false;

  /**
   * @description A object that handles logging to a given logger based on the logging level
   */
  private readonly logger: ManagedLogger;

  /**
   * @description Some serializer that will transform objects into strings
   * and vice versa
   */
  private readonly serializer: ISerializer | JSON;

  /**
   * @description The name of the sessions model
   *
   * Defaults to `session` if `sessionModelName` in options is undefined
   */
  private readonly sessionModelName: Exclude<M, `$${string}`>;

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
    this.options.dbRecordIdFunction?.(sid) ?? cuid2.createId();

  /**
   * Disables store, used when prisma cannot be connected to
   */
  private disable(): void {
    this.invalidConnection = true;
  }

  /**
   * Enables store, used when prisma can be connected to
   */
  private enable(): void {
    this.invalidConnection = false;
  }

  /**
   * Returns if the connect is valid or not, logging an error if it is not.
   */
  private async validateConnection(): Promise<boolean> {
    await (
      this.prisma?.$connect?.() ??
      Promise.reject(new Error('Could not connect'))
    )
      .then(() => {
        this.enable();
        this.startInterval();
      })
      .catch(() => {
        this.disable();
        this.stopInterval();
        this.logger.error(dedent`Could not connect to 'Session' model in Prisma.
      Please make sure that prisma is setup correctly, that 'Session' model exists, and that your migrations are current.
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
        // Calling deleteMany to prevent an error from being thrown. Fix for issue 91
        await this.prisma[this.sessionModelName].deleteMany({
          where: { sid },
        });
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
    const p = this.prisma[this.sessionModelName];

    const session = await p
      .findUnique({
        where: { sid },
      })
      .catch(() => null);

    if (session === null) return callback?.();

    try {
      // If session has has expired (allowing for missing 'expiresAt' and 'sid' fields)
      if (
        session.sid &&
        session.expiresAt &&
        new Date().valueOf() >= session.expiresAt.valueOf()
      ) {
        this.logger.log(`Session with sid: ${sid} expired; deleting.`);
        await p.delete({ where: { sid } });
        return callback?.();
      }

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
    // If a previous invocation of this function using the same sid
    // is in-process, and we're not permitting such concurrent calls
    // (see work-around note above), ensure that the call-in-process
    // completes, before subsequent invocations using the same sid
    // can fully execute.
    if (
      this.options.enableConcurrentSetInvocationsForSameSessionID !== true &&
      this.isSetting.get(sid)
    ) {
      this.logger.warn(
        `Concurrent calls to set() with the same session id are not currently permitted by default. (See README, and https://github.com/kleydon/prisma-session-store/issues/88). To over-ride this behaviour, set PrismaSessionStore's 'enableConcurrentSetInvocationsForSameSessionID' to true.`
      );

      return callback?.();
    }
    // If we don't have a valid connection, we can't continue;
    // return early.
    if (!(await this.validateConnection())) return callback?.();

    // Set a flag to indicate that a set() operation is in progress
    // for this sid. **NOTE**: Be sure this flag is cleared by
    // any/all paths out of this function!
    this.isSetting.set(sid, true);

    // Note: Currently, there are two separate try / catch blocks
    // below to satisfy tests. Ultimately, it may be
    // simpler/preferable to combine these blocks, and
    // re-think the tests.

    let ttl;
    let expiresAt;
    try {
      ttl = getTTL(this.options, session, sid);
      expiresAt = createExpiration(ttl, {
        rounding: this.options.roundTTL,
      });
    } catch (e: unknown) {
      this.logger.error(`set(): ${String(e)}`);
      // Clear flag, to indicate that set() operation
      // is no longer in progress for this sid.
      this.isSetting.set(sid, false);
      throw e; // Re-throwing to satisfy a test. (Does this make sense?)
    }

    let sessionString;
    try {
      sessionString = this.serializer.stringify(session);
    } catch (e: unknown) {
      this.logger.error(`set(): ${String(e)}`);
      // Clear flag, to indicate that set() operation
      // is no longer in progress for this sid.
      this.isSetting.set(sid, false);
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
      // Clear flag, to indicate that set() operation
      // is no longer in progress for this sid.
      this.isSetting.set(sid, false);
      if (callback) defer(callback, e);

      return;
    }

    // Clear flag, to indicate that set() operation
    // is no longer in progress for this sid.
    this.isSetting.set(sid, false);

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
    if (this.checkInterval) return;

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
    // If a previous invocation of this function using the same sid
    // is in-process, and we're not permitting such concurrent calls
    // (see work-around note above), ensure that the call-in-process
    // completes, before subsequent invocations using the same sid
    // can fully execute.
    if (
      this.options.enableConcurrentTouchInvocationsForSameSessionID !== true &&
      this.isTouching.get(sid)
    ) {
      this.logger.warn(
        `Concurrent calls to touch() with the same session id are not currently permitted by default. (See README, and https://github.com/kleydon/prisma-session-store/issues/88). To over-ride this behaviour, set PrismaSessionStore's 'enableConcurrentTouchInvocationsForSameSessionID' to true.`
      );

      return callback?.();
    }
    // If we don't have a valid connection, we can't continue;
    // return early
    if (!(await this.validateConnection())) return callback?.();

    // Set a flag to indicate a touch() operation is in progress
    // for this sid. **NOTE**: Be sure this flag is cleared by
    // any/all paths out of this function!
    this.isTouching.set(sid, true);

    try {
      const ttl = getTTL(this.options, session, sid);
      const expiresAt = createExpiration(ttl, {
        rounding: this.options.roundTTL,
      });

      const existingSession = await this.prisma[
        this.sessionModelName
      ].findUnique({
        where: { sid },
      });

      if (existingSession !== null) {
        const existingSessionData: object = {
          ...this.serializer.parse(existingSession.data ?? '{}'),
          cookie: session.cookie,
        } as object;

        await this.prisma[this.sessionModelName].update({
          where: { sid: existingSession.sid },
          data: {
            expiresAt,
            data: this.serializer.stringify(existingSessionData),
          },
        });
      }

      // *** If there is no found session, for some reason, should it be recreated *** ?
      if (callback) defer(callback);
    } catch (e: unknown) {
      this.logger.error(`touch(): ${String(e)}`);
      if (callback) defer(callback, e);
    } finally {
      // Clear flag, to indicate that touch() operation
      // is no longer in progress for this sid.
      this.isTouching.delete(sid);
    }
  };
}
