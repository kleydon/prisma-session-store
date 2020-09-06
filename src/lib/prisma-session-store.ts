import type { PartialDeep } from 'type-fest';
import cuid from 'cuid';
import { dedent } from 'ts-dedent';

import type {
  IOptions,
  IPrisma,
  IPrismaSession,
  ISession,
  ISessions,
} from '../@types';
import { getTTL, defer, createExpiration } from './utils';
import { ManagedLogger } from './logger';

/**
 * Returns a `PrismaSessionStore` extending the `session` Store class.
 *
 * @param session the `express-session` object which will be used to extend a store from
 */
export default (session: ISession) => {
  return class PrismaSessionStore extends session.Store {
    /**
     * Initialize PrismaSessionStore with the given `prisma` and (optional) `options`.
     *
     * @param prisma the prisma client that includes a `Sessions` model
     * @param options the options to alter how this store behaves
     */
    constructor(
      private readonly prisma: IPrisma,
      private readonly options: IOptions
    ) {
      super(prisma);
      this.startInterval();
      this.prisma.$connect?.();

      (
        this.prisma?.session?.findMany({ select: { sid: true } }) ??
        new Promise((_resolve, reject) => reject())
      ).catch(() =>
        this.logger.error(dedent`Could not connect to Sessions model in Prisma.
        Please make sure that prisma is setup correctly and that your migrations are current.
        For more information check out https://github.com/kleydon/prisma-session-store`)
      );
    }

    /**
     * @private
     * @description The currently active interval created with `startInterval()` and removed with `stopInterval()`
     * @type {NodeJS.Timeout}
     */
    private _checkInterval?: NodeJS.Timeout;

    /**
     * @private
     * @description A function to generate the Prisma Record ID for a given session ID
     *
     * Note: If undefined and dbRecordIdIsSessionId is also undefined then a random
     * CUID will be used instead.
     */
    private dbRecordIdFunction = this.options.dbRecordIdFunction;

    /**
     * @private
     * @description Some serializer that will transform objects into strings
     * and vice versa
     */
    private serializer = this.options.serializer ?? JSON;

    /**
     * @private
     * @description A flag indicating to use the session ID as the Prisma Record ID
     *
     * Note: If undefined and dbRecordIdFunction is also undefined then a random
     * CUID will be used instead.
     */
    private dbRecordIdIsSessionId = this.options.dbRecordIdIsSessionId;

    /**
     * @private
     * @description A object that handles logging to a given logger based on the logging level
     */
    private logger = new ManagedLogger(
      this.options.logger ?? console,
      this.options.loggerLevel ?? ['error']
    );

    /**
     * Attempt to fetch session by the given `sid`.
     *
     * @param sid the sid to attempt to fetch
     * @param callback a function to call with the results
     */
    public readonly get = async (
      sid: string,
      callback: <T>(err?: unknown, val?: Express.SessionData) => void
    ) => {
      const session: IPrismaSession | null = await this.prisma.session
        .findOne({
          where: { sid },
        })
        .catch(() => null);

      if (!session) return callback();

      try {
        const result = this.serializer.parse(
          session.data ?? '{}'
        ) as Express.SessionData;
        if (callback) defer(callback, undefined, result);
      } catch (e: unknown) {
        this.logger.error(`get(): ${e}`);
        if (callback) defer(callback, e);
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
      session: PartialDeep<Express.SessionData>,
      callback?: (err: unknown) => void
    ) => {
      const ttl = getTTL(this.options, session, sid);
      const expires = createExpiration(ttl);

      let sessionString = undefined;
      try {
        sessionString = this.serializer.stringify(session);
      } catch (e: unknown) {
        this.logger.error(`set(): ${e}`);
        if (callback) defer(callback, e);
      }

      const existingSession: IPrismaSession | null = await this.prisma.session
        .findOne({
          where: { sid },
        })
        .catch(() => null);

      const data = {
        id: this.dbRecordIdIsSessionId
          ? sid
          : this.dbRecordIdFunction
          ? this.dbRecordIdFunction(sid)
          : cuid(),
        sid,
        data: sessionString,
        expires,
      };

      if (existingSession) {
        await this.prisma.session.update({
          where: { sid },
          data,
        });
      } else if (sessionString) {
        await this.prisma.session.create({
          data: { ...data, data: sessionString },
        });
      }

      if (callback) defer(callback);
    };

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
      session: PartialDeep<Express.SessionData>,
      callback?: (err?: unknown) => void
    ) => {
      const ttl = getTTL(this.options, session, sid);
      const expires = createExpiration(ttl);

      try {
        const existingSession = await this.prisma.session.findOne({
          where: { sid },
        });

        if (existingSession) {
          const existingSessionData = {
            ...this.serializer.parse(existingSession.data ?? '{}'),
            cookie: session.cookie,
          };

          await this.prisma.session.update({
            where: { sid: existingSession.sid },
            data: {
              sid,
              data: this.serializer.stringify(existingSessionData),
              expires,
            },
          });
        }

        // *** If there is no found session, for some reason, should it be recreated from sess *** ?
        if (callback) defer(callback);
      } catch (e: unknown) {
        this.logger.error(`touch(): ${e}`);
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
      //XXX More efficient way? XXX

      try {
        const sessions = await this.prisma.session.findMany({
          select: { sid: true },
        });

        const sids = sessions.map(({ sid }) => sid);
        if (callback) defer(callback, undefined, sids);
      } catch (e: unknown) {
        if (callback) defer(callback, e);
      }
    };

    /**
     * Fetch all sessions
     *
     * @param callback a callback providing all session data
     * or an error that occurred
     */
    public readonly all = async (
      callback?: (err?: unknown, all?: ISessions) => void
    ) => {
      try {
        const sessions = await this.prisma.session.findMany({
          select: { sid: true, data: true },
        });

        const result = sessions
          .map(
            ({ sid, data }) =>
              [
                sid,
                this.serializer.parse(data ?? '{}') as Express.SessionData,
              ] as const
          )
          .reduce(
            (prev, [sid, data]) => ({ ...prev, [sid]: data }),
            {} as ISessions
          );

        if (callback) defer(callback, undefined, result);
      } catch (e: unknown) {
        this.logger.error(`all(): ${e}`);
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
      try {
        await this.prisma.session.deleteMany();

        if (callback) defer(callback);
      } catch (e: unknown) {
        if (callback) defer(callback, e);
      }
    };

    /**
     * Get the count of all sessions in the store
     *
     * @param callback
     */
    public readonly length = async (
      callback?: (err?: unknown, length?: number) => void
    ) => {
      // XXX More efficient way? XXX

      try {
        const sessions = await this.prisma.session.findMany({
          select: { sid: true }, //Limit what gets sent back; can't be empty.
        });

        const itemCount = sessions.length;
        if (callback) defer(callback, undefined, itemCount);
      } catch (e: unknown) {
        if (callback) defer(callback, e);
      }
    };

    /**
     * Destroy the session associated with the given `sid`(s).
     *
     * @param sid a single or multiple id(s) to remove data for
     * @param callback a callback notifying that the session(s) have
     * been destroyed or that an error occurred
     */
    public readonly destroy = async (
      sid: string | string[],
      callback?: (err?: unknown) => void
    ) => {
      if (Array.isArray(sid)) {
        await Promise.all(sid.map(async (s) => this.destroy(s, callback)));
      } else {
        try {
          await this.prisma.session.delete({ where: { sid } });
        } catch (e: unknown) {
          this.logger.warn(
            `Attempt to destroy non-existent session:${sid} ${e}`
          );
          if (callback) defer(callback, e);
        }
      }

      if (callback) defer(callback);
    };

    /**
     * Remove only expired entries from the store
     */
    public readonly prune = async () => {
      // XXX More efficient way? Maybe when filtering is fully implemented? XXX

      this.logger.log('Checking for any expired sessions...');
      const sessions = await this.prisma.session.findMany({
        select: {
          expires: true,
          sid: true,
        },
      });

      for (const session of sessions) {
        const now = new Date();
        const remainingSec = (session.expires.valueOf() - now.valueOf()) / 1000;
        this.logger.log(`session:${session.sid} expires in ${remainingSec}sec`);

        if (now.valueOf() >= session.expires.valueOf()) {
          this.logger.log(`Deleting session with sid: ${session.sid}`);
          await this.prisma.session.delete({
            where: { sid: session.sid },
          });
        }
      }
    };

    /**
     * Start an interval to prune expired sessions
     */
    public startInterval(): void {
      const ms = this.options.checkPeriod;

      if (ms && typeof ms === 'number') {
        this.stopInterval();
        this._checkInterval = setInterval(() => {
          this.prune();
        }, Math.floor(ms));
      }
    }

    /**
     * Stop checking if sessions have expired
     */
    public stopInterval(): void {
      if (this._checkInterval) clearInterval(this._checkInterval);
    }

    /**
     * A function to stop any ongoing intervals and disconnect from the `PrismaClient`
     */
    public async shutdown(): Promise<void> {
      this.stopInterval();
      await this.prisma.$disconnect();
    }
  };
};
