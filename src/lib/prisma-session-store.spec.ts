import type { IOptions, IPrisma } from '../@types';
import { createPrismaMock, MockStore } from '../mocks';
import { createExpiration, range, sleep } from './utils/testing';

import prismSessionStore from './prisma-session-store';

const PrismaSessionStore = prismSessionStore({ Store: MockStore });

/**
 * Creates a new `PrismaSessionStore` and prisma mock
 * @param options any additional options for the store
 */
const freshStore = async (options: IOptions = {}) => {
  const [prisma, mocks] = createPrismaMock();

  const store = new PrismaSessionStore(prisma, {
    logger: false,
    dbRecordIdIsSessionId: !options.dbRecordIdFunction,
    ...options,
  });

  return [store, mocks] as const;
};

describe('PrismaSessionStore', () => {
  it('should begin with no sessions in the database', async () => {
    const [store, { findManyMock }] = await freshStore();

    findManyMock.mockResolvedValueOnce([]);

    await store.length((err, length) => {
      expect(err).toBeUndefined();
      expect(length).toBe(0);
    });
  });

  it('should read items from prisma', async () => {
    const [store, { findManyMock }] = await freshStore();

    findManyMock.mockResolvedValueOnce(range(10));

    store.length((err, length) => {
      expect(err).toBeUndefined();
      expect(length).toBe(10);
    });
  });

  it('should delete the first item', async () => {
    const [store, { deleteMock }] = await freshStore();

    await store.destroy('sid-0');

    expect(deleteMock).toHaveBeenCalled();
  });

  it('should delete the last item', async () => {
    const [store, { deleteMock }] = await freshStore();

    await store.destroy('sid-9');

    expect(deleteMock).toHaveBeenCalled();
  });

  it('should fail gracefully when attempting to delete non-existent item', async () => {
    const [store, { deleteMock }] = await freshStore();
    deleteMock.mockRejectedValue('Could not delete item');

    const deletePromise = store.destroy('sid-0');
    expect(deletePromise).resolves.toBe(undefined);
  });

  it('should fail gracefully when attempting to get a non-existent entry', async () => {
    const [store, { findOneMock }] = await freshStore();

    findOneMock.mockResolvedValueOnce(null);

    await store.get('sid-0', (err, val) => {
      expect(err).toBeUndefined();
      expect(val).toBeUndefined();
    });
  });

  it('should fail gracefully when attempting to touch a non-existent entry', async () => {
    const [store, { findOneMock }] = await freshStore();

    findOneMock.mockResolvedValueOnce(null);

    await store.touch('sid-0', { cookie: { maxAge: 300 } }, (err) => {
      expect(err).toBeUndefined();
    });
  });

  it('should set a sample entry', async () => {
    const [store, { createMock, findOneMock }] = await freshStore();

    findOneMock.mockResolvedValueOnce(null);
    await store.set('sid-0', { cookie: {}, sample: true });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        data: '{"cookie":{},"sample":true}',
        id: 'sid-0',
        sid: 'sid-0',
      }),
    });
  });

  it('should get a sample entry', async () => {
    const [store, { findOneMock }] = await freshStore();
    findOneMock.mockResolvedValue({ data: '{ "sample": true }' });

    await store.get('sid-0', (err, val) => {
      expect(err).toBeUndefined();
      expect(val.sample).toBe(true);
    });
  });

  it('should set TTL from cookie.maxAge', async () => {
    const [
      store,
      { createMock, findOneMock, findManyMock },
    ] = await freshStore();
    findManyMock.mockResolvedValue([]);
    findOneMock.mockResolvedValueOnce(null);

    await store.set('sid-0', { cookie: { maxAge: 400 }, sample: true });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        data: '{"cookie":{"maxAge":400},"sample":true}',
        id: 'sid-0',
        sid: 'sid-0',
      }),
    });
  });

  it('should prune old sessions', async () => {
    const [store, { findManyMock, deleteMock }] = await freshStore();
    findManyMock.mockResolvedValueOnce([
      { sid: 'sid-0', expires: createExpiration(-1) },
      { sid: 'sid-1', expires: createExpiration(500) },
    ]);
    await store.prune();
    expect(deleteMock).toHaveBeenCalledWith({ where: { sid: 'sid-0' } });
    expect(deleteMock).not.toHaveBeenCalledWith({ where: { sid: 'sid-1' } });
  });

  it('should not get empty entry', async () => {
    const [store, { findOneMock }] = await freshStore();

    findOneMock.mockRejectedValueOnce('sid must be defined');

    await store.get('', (err, val) => {
      expect(err).toBeUndefined();
      expect(val).toBe(undefined);
    });
  });

  it('should not get items that are not found', async () => {
    const [store, { findOneMock }] = await freshStore();

    findOneMock.mockResolvedValueOnce(null);
    await store.get('sid-0', (_err, val) => {
      expect(val).toBeUndefined();
    });
  });

  it('should enable automatic prune for expired entries', async () => {
    const [store, { findManyMock, deleteMock }] = await freshStore({
      checkPeriod: 100,
    });
    findManyMock.mockResolvedValue([{ expires: createExpiration(-1) }]);

    await sleep(100);
    expect(deleteMock).toHaveBeenCalled();

    store.stopInterval();
  });

  it('automatic check for expired entries should be disabled', async () => {
    const [store, { findManyMock, deleteMock }] = await freshStore();

    findManyMock.mockResolvedValue([{ expires: createExpiration(-1) }]);

    await sleep(100);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('should touch a given entry', async () => {
    const [store, { updateMock, findOneMock }] = await freshStore();

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

  it('should fetch all entries Ids', async () => {
    const [store, { findManyMock }] = await freshStore();

    findManyMock.mockResolvedValue(range(10).map((sid) => ({ sid })));

    await store.ids((err, ids) => {
      expect(err).toBeUndefined();
      expect(Array.isArray(ids)).toBeTruthy();
      for (const i of range(10)) {
        expect(ids?.[i]).toBe(i);
      }
    });
  });

  it('should fetch all entries values', async () => {
    const [store, { findManyMock }] = await freshStore();

    findManyMock.mockResolvedValue(
      range(10).map((sid) => ({
        sid,
        data: `{ "i": "${sid}" }`,
      }))
    );

    await store.all((err, all) => {
      expect(err).toBeUndefined();

      expect(typeof all).toBe('object');
      Object.keys(all).forEach((sid) => {
        expect(all[sid].i).toBe(sid);
      });
    });
  });

  it('should count all entries in the store', async () => {
    const [store, { findManyMock }] = await freshStore();

    findManyMock.mockResolvedValue(range(10));

    await store.length((err, n) => {
      if (err) return err;
      expect(n).toBe(10);
    });
  });

  it('should delete all entries from the store', async () => {
    const [store, { deleteManyMock }] = await freshStore();

    await store.clear();

    expect(deleteManyMock).toHaveBeenCalled();
  });

  it('should use the injected logger', async () => {
    const log = jest.fn();
    const warn = jest.fn();

    const [store, { findManyMock, deleteMock }] = await freshStore({
      logger: {
        log,
        warn,
      },
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

  it('should respect logger level', async () => {
    const log = jest.fn();
    const warn = jest.fn();

    const [store, { findManyMock, deleteMock }] = await freshStore({
      logger: {
        log,
        warn,
      },
      loggerLevel: ['warn'],
    });

    // Function that calls warn
    deleteMock.mockRejectedValue('Could not find ID');
    await store.destroy('non-existent-sid');

    // Function that calls log
    findManyMock.mockResolvedValue([]);
    await store.prune();

    expect(warn).toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
