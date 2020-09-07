// tslint:disable: no-default-import
// tslint:disable: no-duplicate-string

import { PrismaClient } from '@prisma/client';

import type { IOptions } from '../@types';
import { createPrismaMock, MockStore } from '../mocks';

import prismaSessionStore from './prisma-session-store';
import { createExpiration, range, sleep } from './utils/testing';

jest.mock('./utils/defer', () => ({
  defer: (fn: Function, ...args: unknown[]) => fn(...args),
}));

const PrismaSessionStore = prismaSessionStore({ Store: MockStore });

/**
 * Creates a new `PrismaSessionStore` and prisma mock
 * @param options any additional options for the store
 */
const freshStore = (options: IOptions = {}) => {
  const [prisma, mocks] = createPrismaMock();

  const store = new PrismaSessionStore(prisma, {
    logger: false,
    dbRecordIdIsSessionId: !options.dbRecordIdFunction,
    ...options,
  });

  return [store, mocks] as const;
};

describe('PrismaSessionStore', () => {
  describe('.length()', () => {
    it('should return 0 if prisma has no items', async () => {
      const [store, { findManyMock }] = freshStore();
      const callback = jest.fn();

      findManyMock.mockResolvedValueOnce([]);

      await store.length(callback);

      expect(callback).toHaveBeenCalledWith(undefined, 0);
    });

    it('should return the same number of items as in prisma', async () => {
      const [store, { findManyMock }] = freshStore();
      const callback = jest.fn();

      findManyMock.mockResolvedValueOnce(range(10));

      await store.length(callback);

      expect(callback).toHaveBeenCalledWith(undefined, 10);
    });

    it('should resolve to length', async () => {
      const [store, { findManyMock }] = freshStore();

      findManyMock.mockResolvedValueOnce(range(10));

      await expect(store.length()).resolves.toBe(10);
    });

    it('should pass errors into callback', async () => {
      const [store, { findManyMock }] = freshStore();
      const callback = jest.fn();

      findManyMock.mockRejectedValue('some error');

      await store.length(callback);

      expect(callback).toHaveBeenCalledWith('some error');
    });

    it('should resolve despite errors occurring', async () => {
      const [store, { findManyMock }] = freshStore();

      findManyMock.mockRejectedValue('some error');

      await expect(store.length()).resolves.toBe(undefined);
    });
  });

  describe('.get()', () => {
    it('should get a sample entry', async () => {
      const [store, { findOneMock }] = freshStore();
      const callback = jest.fn();
      findOneMock.mockResolvedValue({ data: '{ "sample": true }' });

      await store.get('sid-0', callback);

      expect(callback).toHaveBeenCalledWith(undefined, { sample: true });
    });

    it('should not get empty entry', async () => {
      const [store, { findOneMock }] = freshStore();
      const callback = jest.fn();

      findOneMock.mockRejectedValueOnce('sid must be defined');

      await store.get('', callback);

      expect(callback).toHaveBeenCalledWith();
    });

    it('should not get items that are not found', async () => {
      const [store, { findOneMock }] = freshStore();
      const callback = jest.fn();

      findOneMock.mockResolvedValueOnce(null);
      await store.get('sid-0', callback);

      expect(callback).toHaveBeenCalledWith();
    });

    it('should resolve to a promise', async () => {
      const [store, { findOneMock }] = freshStore();

      findOneMock.mockResolvedValueOnce(null);
      await expect(store.get('sid-0')).resolves.toBe(undefined);

      findOneMock.mockResolvedValueOnce({ data: '{ "sample": true }' });
      await expect(store.get('sid-0')).resolves.toStrictEqual({ sample: true });
    });

    it('should pass errors to the callback', async () => {
      const [store, { findOneMock }] = freshStore();
      const callback = jest.fn();

      findOneMock.mockResolvedValueOnce({ data: '{ invalid json' });
      await store.get('sid-0', callback);

      expect(callback).toHaveBeenCalledWith(
        new SyntaxError('Unexpected token i in JSON at position 2')
      );
    });

    it('should handle empty session data', async () => {
      const [store, { findOneMock }] = freshStore();

      findOneMock.mockResolvedValueOnce({ data: null });
      await expect(store.get('sid-0')).resolves.toStrictEqual({});
    });
  });

  describe('.destroy()', () => {
    it('should delete the first item', async () => {
      const [store, { deleteMock }] = freshStore();

      await store.destroy('sid-0');

      expect(deleteMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sid: 'sid-0' } })
      );
    });

    it('should fail gracefully when attempting to delete non-existent item', async () => {
      const [store, { deleteMock }] = freshStore();
      deleteMock.mockRejectedValue('Could not delete item');

      const deletePromise = store.destroy('sid-0');

      await expect(deletePromise).resolves.toBe(undefined);
    });

    it('should delete an array of sids', async () => {
      const [store, { deleteMock }] = freshStore();

      await store.destroy(['sid-0', 'sid-1', 'sid-2']);

      expect(deleteMock).toHaveBeenCalledTimes(3);
    });

    it('should pass errors to callback', async () => {
      const [store, { deleteMock }] = freshStore();
      const callback = jest.fn();

      deleteMock.mockRejectedValue('some error');

      await store.destroy('sid-0', callback);

      expect(callback).toHaveBeenCalledWith('some error');
    });
  });

  describe('.touch()', () => {
    it('should update a given entry', async () => {
      const [store, { updateMock, findOneMock }] = freshStore();

      findOneMock.mockResolvedValue({ sid: 'sid-0', data: '{}' });
      await store.touch('sid-0', { cookie: { maxAge: 300 } });
      expect(updateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: '{"cookie":{"maxAge":300}}',
        }),
        where: {
          sid: 'sid-0',
        },
      });
    });

    it('should fail gracefully when attempting to touch a non-existent entry', async () => {
      const [store, { findOneMock }] = freshStore();
      const callback = jest.fn();

      findOneMock.mockResolvedValueOnce(null);

      await store.touch('sid-0', { cookie: { maxAge: 300 } }, callback);

      expect(callback).toHaveBeenCalledWith();
    });

    it('should send errors to the callback', async () => {
      const [store, { findOneMock }] = freshStore();
      const callback = jest.fn();

      findOneMock.mockRejectedValue('some error');

      await store.touch('sid-0', { data: '' }, callback);

      expect(callback).toHaveBeenCalledWith('some error');
    });

    it('should resolve despite errors occurring', async () => {
      const [store, { findOneMock }] = freshStore();

      findOneMock.mockRejectedValue('some error');

      await expect(store.touch('sid-0', { data: '' })).resolves.toBe(undefined);
    });

    it('should use an empty object if session data does not exist', async () => {
      const [store, { findOneMock, updateMock }] = freshStore();
      findOneMock.mockResolvedValue({ data: null });

      await store.touch('sid-0', { cookie: { secure: false } });

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: '{"cookie":{"secure":false}}',
          }),
        })
      );
    });
  });

  describe('.set()', () => {
    it('should create a new session if none exist', async () => {
      const [store, { createMock }] = freshStore();

      await store.set('sid-0', { cookie: {}, sample: true });
      expect(createMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: '{"cookie":{},"sample":true}',
          id: 'sid-0',
          sid: 'sid-0',
        }),
      });
    });

    it('should update any existing sessions', async () => {
      const [store, { updateMock, findOneMock }] = freshStore();

      findOneMock.mockResolvedValue({
        sid: 'sid-0',
        data: '{"sample": false}',
      });

      await store.set('sid-0', { cookie: {}, sample: true });
      expect(updateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: '{"cookie":{},"sample":true}',
          id: 'sid-0',
          sid: 'sid-0',
        }),
        where: {
          sid: 'sid-0',
        },
      });
    });

    it('should set TTL from cookie.maxAge', async () => {
      const [store, { createMock }] = freshStore();

      await store.set('sid-0', { cookie: { maxAge: 400 }, sample: true });
      expect(createMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: '{"cookie":{"maxAge":400},"sample":true}',
          id: 'sid-0',
          sid: 'sid-0',
        }),
      });
    });

    it('should send errors to the callback', async () => {
      const stringify = jest.fn();
      const [store] = freshStore({
        serializer: { stringify, parse: jest.fn() },
      });
      const callback = jest.fn();

      stringify.mockImplementation(() => {
        throw new Error('Some error');
      });

      await store.set('sid-0', { unrealizable: '' }, callback);
      expect(callback).toHaveBeenCalledWith(new Error('Some error'));
    });

    it('should fail gracefully when it cannot fetch existing sessions', async () => {
      const [store, { findOneMock }] = freshStore();
      const callback = jest.fn();

      findOneMock.mockRejectedValue('Could not connect to prisma');

      await store.set('sid-0', { data: '' }, callback);

      expect(callback).toHaveBeenCalledWith();
    });

    it('should use dbRecordIdFunction if present', async () => {
      const dbRecordIdFunction = jest.fn();
      const [store, { createMock }] = freshStore({ dbRecordIdFunction });

      dbRecordIdFunction.mockReturnValue('some-id');

      await store.set('sid-0', {});

      expect(createMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'some-id',
        }),
      });
    });

    it('should should not reject when errors occur', async () => {
      const stringify = jest.fn();
      const [store] = freshStore({
        serializer: { stringify, parse: jest.fn() },
      });

      stringify.mockImplementation(() => {
        throw new Error();
      });

      await expect(store.set('sid-0', {})).resolves.toBe(undefined);
    });
  });

  describe('.prune()', () => {
    it('should prune old sessions', async () => {
      const [store, { findManyMock, deleteMock }] = freshStore();

      findManyMock.mockResolvedValueOnce([
        { sid: 'sid-0', expires: createExpiration(-1) },
        { sid: 'sid-1', expires: createExpiration(500) },
      ]);
      deleteMock.mockResolvedValue(undefined);

      await store.prune();

      expect(deleteMock).toHaveBeenCalledWith({ where: { sid: 'sid-0' } });
      expect(deleteMock).not.toHaveBeenCalledWith({ where: { sid: 'sid-1' } });
    });
  });

  describe('.ids()', () => {
    it('should fetch all entries Ids', async () => {
      const [store, { findManyMock }] = freshStore();
      const callback = jest.fn();

      findManyMock.mockResolvedValue(range(10).map((sid) => ({ sid })));

      await store.ids(callback);

      expect(callback).toHaveBeenCalledWith(undefined, range(10));
    });

    it('should pass errors to callback', async () => {
      const [store, { findManyMock }] = freshStore();
      const callback = jest.fn();

      findManyMock.mockRejectedValue('Could not connect to db');

      await store.ids(callback);

      expect(callback).toHaveBeenCalledWith('Could not connect to db');
    });

    it('should resolve despite errors occurring', async () => {
      const [store, { findManyMock }] = freshStore();

      findManyMock.mockRejectedValue('Could not connect to db');

      await expect(store.ids()).resolves.toBe(undefined);
    });

    it('should resolve ids', async () => {
      const [store, { findManyMock }] = freshStore();

      findManyMock.mockResolvedValue(range(10).map((sid) => ({ sid })));

      await expect(store.ids()).resolves.toStrictEqual(range(10));
    });
  });

  describe('.all()', () => {
    it('should fetch all entries values', async () => {
      const [store, { findManyMock }] = freshStore();
      const callback = jest.fn();

      findManyMock.mockResolvedValue(
        range(10).map((sid) => ({
          sid,
          data: `{ "i": "${sid}" }`,
        }))
      );

      await store.all(callback);

      const expected = Object.fromEntries(
        range(10).map((sid) => [sid, { i: `${sid}` }])
      );
      expect(callback).toHaveBeenCalledWith(undefined, expected);
    });

    it('should send errors to callback', async () => {
      const [store, { findManyMock }] = freshStore();
      const callback = jest.fn();

      findManyMock.mockRejectedValue('some error');

      await store.all(callback);

      expect(callback).toHaveBeenCalledWith('some error');
    });

    it('should resolve despite errors occurring', async () => {
      const [store, { findManyMock }] = freshStore();

      findManyMock.mockRejectedValue('Could not connect to db');

      await expect(store.all()).resolves.toBe(undefined);
    });

    it("should return an empty object if the session data doesn't exist", async () => {
      const [store, { findManyMock }] = freshStore();
      findManyMock.mockResolvedValue([{ sid: 'sid-1', data: null }]);

      const sessions = await store.all();
      if (!sessions) fail('Invalid return value');

      expect(sessions['sid-1']).toStrictEqual({});
    });
  });

  describe('.clear()', () => {
    it('should delete all entries from the store', async () => {
      const [store, { deleteManyMock }] = freshStore();

      await store.clear();

      expect(deleteManyMock).toHaveBeenCalled();
    });

    it('should callback when complete', async () => {
      const [store] = freshStore();
      const callback = jest.fn();

      await store.clear(callback);

      expect(callback).toHaveBeenCalled();
    });

    it('pass errors to callback', async () => {
      const [store, { deleteManyMock }] = freshStore();
      const callback = jest.fn();

      deleteManyMock.mockRejectedValue('some error');

      await store.clear(callback);

      expect(callback).toHaveBeenCalledWith('some error');
    });

    it('resolve despite errors occurring', async () => {
      const [store, { deleteManyMock }] = freshStore();

      deleteManyMock.mockRejectedValue('some error');

      await expect(store.clear()).resolves.toBe(undefined);
    });
  });

  describe('.shutdown()', () => {
    it('should disconnect', async () => {
      const [store, { disconnectMock }] = freshStore();

      await store.shutdown();

      expect(disconnectMock).toHaveBeenCalled();
    });
  });

  describe('options', () => {
    describe('prisma', () => {
      it('should fail gracefully with invalid prisma objects', async () => {
        const invalidPrisma = new PrismaSessionStore(
          (undefined as unknown) as PrismaClient,
          {
            logger: false,
          }
        );
        const invalidPrismaKeys = new PrismaSessionStore(
          ({} as unknown) as PrismaClient,
          {
            logger: false,
          }
        );

        const callback = jest.fn();

        // Without callbacks
        await invalidPrisma.get('');
        await invalidPrisma.set('', {});
        await invalidPrisma.touch('', {});
        await invalidPrisma.destroy('');
        await invalidPrisma.all();
        await invalidPrisma.ids();
        await invalidPrisma.length();
        await invalidPrisma.prune();
        await invalidPrisma.clear();

        await invalidPrismaKeys.get('');
        await invalidPrismaKeys.set('', {});
        await invalidPrismaKeys.touch('', {});
        await invalidPrismaKeys.destroy('');
        await invalidPrismaKeys.all();
        await invalidPrismaKeys.ids();
        await invalidPrismaKeys.length();
        await invalidPrismaKeys.prune();
        await invalidPrismaKeys.clear();

        // With callbacks
        await invalidPrisma.get('', callback);
        await invalidPrisma.set('', {}, callback);
        await invalidPrisma.touch('', {}, callback);
        await invalidPrisma.destroy('', callback);
        await invalidPrisma.all(callback);
        await invalidPrisma.ids(callback);
        await invalidPrisma.length(callback);
        await invalidPrisma.clear(callback);

        await invalidPrismaKeys.get('', callback);
        await invalidPrismaKeys.set('', {}, callback);
        await invalidPrismaKeys.touch('', {}, callback);
        await invalidPrismaKeys.destroy('', callback);
        await invalidPrismaKeys.all(callback);
        await invalidPrismaKeys.ids(callback);
        await invalidPrismaKeys.length(callback);
        await invalidPrismaKeys.clear(callback);

        expect(callback).toHaveBeenCalledTimes(16);
      });
    });

    describe('serializer', () => {
      it('should support custom serializer', async () => {
        const parse = jest.fn();
        const stringify = jest.fn();

        const [store, { findOneMock }] = freshStore({
          serializer: { parse, stringify },
        });

        findOneMock.mockResolvedValue({ data: '{}' });
        await store.touch('sid-0', {});

        expect(parse).toHaveBeenCalled();
        expect(stringify).toHaveBeenCalled();
      });
    });

    describe('logger', () => {
      it('should use the injected logger', async () => {
        const log = jest.fn();
        const warn = jest.fn();

        const [store, { findManyMock, deleteMock }] = freshStore({
          logger: { log, warn },
          loggerLevel: ['log', 'warn'],
        });

        // Function that calls warn
        deleteMock.mockRejectedValue('Could not find ID');
        await store.destroy('non-existent-sid');

        // Function that calls log
        findManyMock.mockResolvedValue([]);
        await store.prune();

        expect(warn).toHaveBeenCalled();
        expect(log).toHaveBeenCalled();
      });

      it('should use a default logger', async () => {
        const [store] = freshStore({
          logger: undefined,
          loggerLevel: [],
        });
        await expect(store.destroy('invalid-key')).resolves.toBe(undefined);
      });

      it('should support a partially implemented logger', async () => {
        const log = jest.fn();
        const warn = jest.fn();
        const error = jest.fn();

        const [logOnly, { findOneMock: logFindOne }] = freshStore({
          logger: { log },
          loggerLevel: ['error', 'log', 'warn'],
        });

        const [warnOnly, { findOneMock: warnFindOne }] = freshStore({
          logger: { warn },
          loggerLevel: ['error', 'log', 'warn'],
        });

        const [errorOnly, { findOneMock: errorFindOne }] = freshStore({
          logger: { error },
          loggerLevel: ['error', 'log', 'warn'],
        });

        logFindOne.mockResolvedValue({ data: 'invalid-json' });
        warnFindOne.mockResolvedValue({ data: 'invalid-json' });
        errorFindOne.mockResolvedValue({ data: 'invalid-json' });

        // Function that calls warn
        await logOnly.destroy('');
        await warnOnly.destroy('');
        await errorOnly.destroy('');

        // Function that calls log
        await logOnly.prune();
        await warnOnly.prune();
        await errorOnly.prune();

        // Function that calls error
        await logOnly.get('');
        await warnOnly.get('');
        await errorOnly.get('');

        expect(log).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalledTimes(1);
      });
    });

    describe('loggerLevel', () => {
      it('should respect logger level', async () => {
        const log = jest.fn();
        const warn = jest.fn();

        const [store] = freshStore({
          logger: { log, warn },
          loggerLevel: ['warn'],
        });

        // Function that calls warn
        await store.destroy('non-existent-sid');

        // Function that calls log
        await store.prune();

        expect(warn).toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
      });

      it('should support array logger levels and single level logger levels', async () => {
        const log = jest.fn();
        const warn = jest.fn();
        const error = jest.fn();

        const [singleLevel, { findOneMock: singleFindOne }] = freshStore({
          logger: { log, warn, error },
          loggerLevel: 'error',
        });

        const [loggerArray, { findOneMock: arrayFindOne }] = freshStore({
          logger: { log, warn, error },
          loggerLevel: ['warn', 'log'],
        });

        singleFindOne.mockResolvedValue({ data: 'invalid-json' });
        arrayFindOne.mockResolvedValue({ data: 'invalid-json' });

        // Function that calls warn
        await singleLevel.destroy('');
        await loggerArray.destroy('');

        // Function that calls log
        await singleLevel.prune();
        await loggerArray.prune();

        // Function that calls error
        await singleLevel.get('');
        await loggerArray.get('');

        expect(log).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalledTimes(1);
      });
    });

    describe('checkPeriod', () => {
      it('should enable automatic prune for expired entries', async () => {
        const [store, { findManyMock, deleteMock }] = freshStore({
          checkPeriod: 10,
        });
        deleteMock.mockResolvedValue(undefined);
        findManyMock.mockResolvedValue([{ expires: createExpiration(-1) }]);

        await sleep(10);
        expect(deleteMock).toHaveBeenCalled();

        store.stopInterval();
      });

      it('automatic check for expired entries should be disabled', async () => {
        const [, { findManyMock, deleteMock }] = freshStore({
          checkPeriod: undefined,
        });

        findManyMock.mockResolvedValue([{ expires: createExpiration(-1) }]);

        await sleep(10);
        expect(deleteMock).not.toHaveBeenCalled();
      });
    });

    describe('ttl', () => {
      it('should use provided ttl time', async () => {
        const [store, { createMock }] = freshStore({ ttl: 500 });

        await store.set('sid-0', {});

        expect(createMock).toHaveBeenCalledWith({
          data: expect.objectContaining({
            expires: createExpiration(500),
          }),
        });
      });

      it('should use provided ttl factory', async () => {
        const [store, { createMock }] = freshStore({ ttl: () => 500 });

        await store.set('sid-0', {});

        expect(createMock).toHaveBeenCalledWith({
          data: expect.objectContaining({
            expires: createExpiration(500),
          }),
        });
      });

      it('should throw if ttl is not a function or number', async () => {
        const [store] = freshStore({ ttl: ('12' as unknown) as number });

        await expect(store.set('sid-0', {})).rejects.toBeTruthy();
      });

      it('should use cookie maxAge if ttl is undefined', async () => {
        const [store, { createMock }] = freshStore({ ttl: undefined });

        await store.set('sid-0', { cookie: { maxAge: 100 } });

        expect(createMock).toHaveBeenCalledWith({
          data: expect.objectContaining({
            expires: createExpiration(100),
          }),
        });
      });

      it('should override cookie maxAge', async () => {
        const [store, { createMock }] = freshStore({ ttl: 500 });

        await store.set('sid-0', { cookie: { maxAge: 100 } });

        expect(createMock).toHaveBeenCalledWith({
          data: expect.objectContaining({
            expires: createExpiration(500),
          }),
        });
      });
    });
  });
});
