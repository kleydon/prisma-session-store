import type { IOptions, IPrisma, IPrismaSession, ISession } from '../@types';
import type { PartialDeep } from 'type-fest';

import { getTTL, defer } from './utils';
import { Logger } from './logger';

/**
 * Return the `PrismaSessionStore` extending `express`'s session Store.
 *
 * @param express session
 */
export default ({ Store }: ISession) => {
  return class PrismaSessionStore extends Store {
    /**
     * Initialize PrismaSessionStore with the given `prisma` and (optional) `options`.
     *
     * @param prisma
     * @param options
     */
    constructor(
      private readonly prisma: IPrisma,
      private readonly options: IOptions
    ) {
      super(prisma);
      this.startInterval();
      this.prisma.$connect();
    }

    public async shutdown() {
      this.stopInterval();
      await this.prisma.$disconnect();
    }

    private _checkInterval?: NodeJS.Timeout;
    private dbRecordIdFunction = this.options.dbRecordIdFunction;
    private serializer = this.options.serializer ?? JSON;
    private dbRecordIdIsSessionId = this.options.dbRecordIdIsSessionId;
    private logger = new Logger(
      this.options.logger ?? console,
      this.options.loggerLevel ?? ['error']
    );

    /**
     * Attempt to fetch session by the given `sid`.
     *
     * @param sid
     * @param callback
     */
    public get = async (
      sid: string,
      callback: (err?: any, val?: any) => void
    ) => {
      const session: IPrismaSession | null = await this.prisma.session
        .findOne({
          where: { sid },
        })
        .catch(() => null);

      if (!session) return callback();

      try {
        const result = this.serializer.parse(session.data ?? '{}');
        if (callback) defer(callback, null, result);
      } catch (e) {
        if (callback) defer(callback, e);
      }
    };

    /**
     * Commit the given `sess` object associated with the given `sid`.
     *
     * @param sid
     * @param session
     * @param callback
     */
    public set = async (
      sid: string,
      session: PartialDeep<Express.SessionData>,
      callback?: (err?: any) => void
    ) => {
      const prisma = this.prisma;
      const dbRecordIdFunction = this.dbRecordIdFunction;
      const dbRecordIdIsSessionId = this.dbRecordIdIsSessionId;

      const ttl = getTTL(this.options, session, sid);
      const expires = new Date(new Date().valueOf() + ttl);

      let sessionString = undefined;
      try {
        sessionString = this.serializer.stringify(session);
      } catch (e) {
        if (callback) defer(callback, e);
      }

      const existingSession: IPrismaSession | null = await prisma.session
        .findOne({
          where: { sid },
        })
        .catch(() => null);

      const data = {
        id: dbRecordIdIsSessionId
          ? sid
          : dbRecordIdFunction
          ? dbRecordIdFunction()
          : undefined,
        sid,
        data: sessionString,
        expires,
      };

      if (existingSession) {
        await prisma.session.update({
          where: { sid },
          data,
        });
      } else if (sessionString) {
        await prisma.session.create({
          data: { ...data, data: sessionString },
        });
      }

      if (callback) defer(callback, null);
    };

    /**
     * Refresh the time-to-live for the session with the given `sid`.
     *
     * @param sid
     * @param session
     * @param callback
     */
    public touch = async (
      sid: string,
      session: PartialDeep<Express.SessionData>,
      callback?: (err?: any, val?: any) => void
    ) => {
      const ttl = getTTL(this.options, session, sid);
      const expires = new Date(new Date().valueOf() + ttl);

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
      } catch (e) {
        this.logger.log('touch(): ' + e);
        if (callback) defer(callback, e);
      }
    };

    /**
     * Fetch all sessions' ids
     *
     * @param callback
     */
    public ids = async (callback?: (err?: any, ids?: number[]) => void) => {
      //XXX More efficient way? XXX

      const sessions = await this.prisma.session.findMany({
        select: { sid: true },
      });

      const sids = sessions.map(({ sid }) => sid);
      callback && defer(callback, null, sids);
    };

    /**
     * Fetch all sessions
     *
     * @param callback
     */
    public all = async (callback?: (err?: any, all?: any) => void) => {
      const prisma = this.prisma;
      const serializer = this.serializer;

      try {
        const sessions = await prisma.session.findMany();
        const result = sessions
          .map(({ sid, data }) => [sid, serializer.parse(data ?? '{}')])
          .reduce((prev, [sid, data]) => ({ ...prev, [sid]: data }), {});
        if (callback) defer(callback, null, result);
      } catch (e) {
        if (callback) defer(callback, e);
      }
    };

    /**
     * Delete all sessions from the store
     *
     * @param callback
     */
    clear = async (callback?: (err?: any) => void) => {
      await this.prisma.session.deleteMany();

      if (callback) defer(callback, null);
    };

    /**
     * Get the count of all sessions in the store
     *
     * @param callback
     */
    public length = async (callback?: (err?: any, length?: number) => void) => {
      // XXX More efficient way? XXX

      const sessions = await this.prisma.session.findMany({
        select: { sid: true }, //Limit what gets sent back; can't be empty.
      });

      const itemCount = sessions.length;
      if (callback) defer(callback, null, itemCount);
    };

    /**
     * Start the check interval
     */
    public startInterval() {
      const ms = this.options.checkPeriod;

      if (ms && typeof ms === 'number') {
        this.stopInterval();
        this._checkInterval = setInterval(() => {
          this.prune();
        }, Math.floor(ms));
      }
    }

    /**
     * Stop the check interval
     */
    public stopInterval() {
      if (this._checkInterval) clearInterval(this._checkInterval);
    }

    /**
     * Destroy the session associated with the given `sid`.
     *
     * @param sid
     * @param callback
     */
    public destroy = async (
      sid: string | string[],
      callback?: (err?: any) => void
    ) => {
      if (Array.isArray(sid)) {
        await Promise.all(sid.map(async (s) => this.destroy(s, callback)));
      } else {
        try {
          await this.prisma.session.delete({ where: { sid } });
        } catch (e) {
          this.logger.warn(
            `Attempt to destroy non-existent session:${sid} ${e}`
          );
          if (callback) defer(callback, e);
        }
      }

      if (callback) defer(callback, null);
    };

    /**
     * Remove only expired entries from the store
     */
    public prune = async () => {
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
  };
};
