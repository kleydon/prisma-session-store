import type { Options, Prisma, PrismaSession } from './@types';
import type { Store } from 'express-session';
import type { PartialDeep } from 'type-fest';

/**
 * One day in milliseconds.
 */
const ONE_DAY = 86400000;

function getTTL(
  options: Options,
  session: PartialDeep<Express.SessionData>,
  sid: string
) {
  if (typeof options.ttl === 'number') return options.ttl;
  if (typeof options.ttl === 'function')
    return options.ttl(options, session, sid);
  if (options.ttl)
    throw new TypeError('`options.ttl` must be a number or function.');

  const maxAge = session && session.cookie ? session.cookie.maxAge : null;
  return typeof maxAge === 'number' ? Math.floor(maxAge) : ONE_DAY;
}

const defer = <T extends Function, A extends any[]>(
  callback: T,
  ...args: A
) => {
  setImmediate(() => {
    callback(...args);
  });
};

interface Session {
  Store: typeof Store;
}

/**
 * Return the `PrismaSessionStore` extending `express`'s session Store.
 *
 * @param express session
 * @api public
 */
export default ({ Store }: Session) => {
  return class PrismaSessionStore extends Store {
    /**
     * Initialize PrismaSessionStore with the given `prisma` and (optional) `options`.
     *
     * @param prisma
     * @param options
     */
    constructor(
      public readonly prisma: Prisma,
      public readonly options: Options
    ) {
      super(prisma);
      this.startInterval();
      this.prisma.$connect();
    }

    public shutdown() {
      this.prisma.$disconnect();
    }

    public _checkInterval?: NodeJS.Timeout;
    private dbRecordIdFunction = this.options.dbRecordIdFunction;
    private serializer = this.options.serializer ?? JSON;
    private dbRecordIdIsSessionId = this.options.dbRecordIdIsSessionId;
    private logger = this.options.logger ?? console;

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
      const prisma = this.prisma;

      let session: PrismaSession | null = null;
      try {
        session = await prisma.session.findOne({
          where: { sid },
        });
      } catch (e) {}

      if (!session) return callback();

      let err = null;
      let result;
      try {
        result = this.serializer.parse(session.data);
      } catch (e) {
        err = e;
      }

      callback && defer(callback, err, result);
    };

    /**
     * Commit the given `sess` object associated with the given `sid`.
     *
     * @param sid
     * @param sess
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

      let sessionString = null;
      try {
        sessionString = this.serializer.stringify(session);
      } catch (e) {
        callback && defer(callback, e);
      }

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

      let existingSession: boolean | PrismaSession = false;
      try {
        existingSession = await prisma.session.findOne({
          where: { sid },
        });
      } catch (e) {}

      if (existingSession) {
        await prisma.session.update({
          where: { sid },
          data,
        });
      } else {
        await prisma.session.create({
          data,
        });
      }

      callback && defer(callback, null);
    };

    /**
     * Refresh the time-to-live for the session with the given `sid`.
     *
     * @param sid
     * @param sess
     * @param callback
     */
    public touch = async (
      sid: string,
      sess: PartialDeep<Express.SessionData>,
      callback?: (err?: any, val?: any) => void
    ) => {
      const prisma = this.prisma;

      const ttl = getTTL(this.options, sess, sid);
      const expires = new Date(new Date().valueOf() + ttl);

      let err = null;
      try {
        const existingSession = await prisma.session.findOne({
          where: { sid },
        });

        if (existingSession) {
          const existingSessionData = {
            ...this.serializer.parse(existingSession.data),
            cookie: sess.cookie,
          };

          await prisma.session.update({
            where: { sid: existingSession.sid },
            data: {
              sid,
              data: this.serializer.stringify(existingSessionData),
              expires,
            },
          });
        }
      } catch (e) {
        if (this.logger) this.logger.log('touch(): ' + e);
        err = e;
      }

      // *** If there is no found session, for some reason, should it be recreated from sess *** ?

      callback && defer(callback, err);
    };

    /**
     * Fetch all sessions' ids
     *
     * @param callback
     * @api public
     */
    public ids = async function (
      callback?: (err?: any, ids?: number[]) => void
    ) {
      const prisma = this.prisma;

      //XXX More efficient way? XXX

      const sessions = await prisma.session.findMany({
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

      let err = null;
      let result = {};
      try {
        const sessions = await prisma.session.findMany();
        for (let i = 0; i < sessions.length; i++) {
          const session = sessions[i];
          result[session.sid] = serializer.parse(session.data);
        }
      } catch (e) {
        err = e;
      }

      callback && defer(callback, err, result);
    };

    /**
     * Delete all sessions from the store
     *
     * @param callback
     */
    clear = async function (callback?: (err?: any) => void) {
      const prisma = this.prisma;

      await prisma.session.deleteMany();

      callback && defer(callback, null);
    };

    /**
     * Get the count of all sessions in the store
     *
     * @param callback
     */
    public length = async (callback?: (err?: any, length?: number) => void) => {
      const prisma = this.prisma;

      // XXX More efficient way? XXX

      const sessions = await prisma.session.findMany({
        select: { sid: true }, //Limit what gets sent back; can't be empty.
      });

      const itemCount = sessions.length;

      callback && defer(callback, null, itemCount);
    };

    /**
     * Start the check interval
     */
    public startInterval() {
      const ms = this.options.checkPeriod;

      if (ms && typeof ms === 'number') {
        clearInterval(this._checkInterval);
        this._checkInterval = setInterval(() => {
          this.prune();
        }, Math.floor(ms));
      }
    }

    /**
     * Stop the check interval
     */
    public stopInterval() {
      clearInterval(this._checkInterval);
    }

    /**
     * Destroy the session associated with the given `sid`.
     *
     * @param sid
     * @param callback
     */
    public destroy = async (sid: string, callback?: (err?: any) => void) => {
      const prisma = this.prisma;

      if (Array.isArray(sid)) {
        sid.forEach(async function (s) {
          try {
            await prisma.session.delete({ where: { sid } });
          } catch (e) {
            //this.logger.log('Attempt to destroy non-existent session:' + sid + ' ' + e)
          }
        });
      } else {
        try {
          await prisma.session.delete({ where: { sid } });
        } catch (e) {
          //this.logger.log('Attempt to destroy non-existent session:' + sid + ' ' + e)
        }
      }

      callback && defer(callback, null);
    };

    /**
     * Remove only expired entries from the store
     */
    public prune = async () => {
      // XXX More efficient way? Maybe when filtering is fully implemented? XXX

      if (this.logger) this.logger.log('Checking for any expired sessions...');
      const sessions = await this.prisma.session.findMany({
        select: {
          expires: true,
          sid: true,
        },
      });

      for (const session of sessions) {
        const now = new Date();
        const remainingSec = (session.expires.valueOf() - now.valueOf()) / 1000;
        //this.logger.log('session:' + s.sid + ' expires in ' + remainingSec + 'sec')

        if (now.valueOf() >= session.expires.valueOf()) {
          if (this.logger)
            this.logger.log('Deleting session with sid: ' + session.sid);
          await this.prisma.session.delete({
            where: { sid: session.sid },
          });
        }
      }
    };
  };
};
