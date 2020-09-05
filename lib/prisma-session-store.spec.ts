import { PrismaClient } from '@prisma/client';

import type { Options } from './@types';
import { MockStore } from './mocks';
import { createExpiration, range, sleep } from './utils/testing';

import prismSessionStore from './prisma-session-store';

const prisma = new PrismaClient();
const PrismaSessionStore = prismSessionStore({ Store: MockStore });

const freshStore = async (prisma: PrismaClient, options: Options = {}) => {
  const store = new PrismaSessionStore(prisma, {
    logger: false,
    dbRecordIdIsSessionId: !options.dbRecordIdFunction,
    ...options,
  });

  await store.clear(async () => {
    await store.length((err, length) => {
      expect(err).toBe(null);
      expect(length).toBe(0);
    });
  });

  return store;
};

describe('PrismaSessionStore', () => {
  let store: typeof PrismaSessionStore.prototype;

  afterEach(async () => {
    await store.shutdown();
  });

  it('should begin with no sessions in the database', async () => {
    store = await freshStore(prisma);

    await store.length((err, length) => {
      expect(err).toBe(null);
      expect(length).toBe(0);
    });
  });

  it('should contain 10 items', async () => {
    store = await freshStore(prisma);

    for (const i of range(10)) {
      await store.set(`${i}`, {
        cookie: { expires: createExpiration(600) },
      });
    }

    store.length((err, length) => {
      expect(err).toBe(null);
      expect(length).toBe(10);
    });
  });

  it('should delete the first item', async () => {
    store = await freshStore(prisma);

    for (const i of range(15)) {
      await store.set(`sid-${i}`, {
        cookie: { expires: createExpiration(600) },
      });
    }

    await store.destroy('sid-0');

    await store.length((err, length) => {
      expect(err).toBe(null);
      expect(length).toBe(14);
    });
  });

  it('should delete the last item', async () => {
    store = await freshStore(prisma);

    for (const i of range(10)) {
      await store.set(`sid-${i}`, {
        cookie: { expires: createExpiration(600) },
      });
    }

    await store.destroy('sid-9');

    await store.length((err, length) => {
      expect(err).toBe(null);
      expect(length).toBe(9);
    });

    for (const i of range(12, 9)) {
      await store.set(`sid-${i}`, {
        cookie: { expires: createExpiration(600) },
      });
    }

    await store.length((err, length) => {
      expect(err).toBe(null);
      expect(length).toBe(12);
    });
  });

  it('should fail gracefully when attempting to delete non-existent item', async () => {
    store = await freshStore(prisma);

    await store.destroy('sid-0');

    await store.length((err, length) => {
      expect(err).toBe(null);
      expect(length).toBe(0);
    });
  });

  it('should fail gracefully when attempting to get a non-existent entry', async () => {
    store = await freshStore(prisma);

    await store.get('sid-0', (err, val) => {
      expect(err).toBeUndefined();
      expect(val).toBeUndefined();
    });
  });

  it('should fail gracefully when attempting to touch a non-existent entry', async () => {
    store = await freshStore(prisma);

    await store.touch('sid-0', { cookie: { maxAge: 300 } }, (err, val) => {
      expect(err).toBeUndefined();
      expect(val).toBeUndefined();
    });
  });

  it('should set and get a sample entry', async () => {
    store = await freshStore(prisma);

    await store.set('sid-0', { cookie: {}, sample: true });
    await store.get('sid-0', (err, val) => {
      expect(err).toBe(null);
      expect(val.sample).toBe(true);
    });
  });

  it('should set TTL from cookie.maxAge', async () => {
    store = await freshStore(prisma, { checkPeriod: 50 });

    await store.set('sid-0', { cookie: { maxAge: 400 }, sample: true });
    await store.get('sid-0', (err, val) => {
      expect(err).toBe(null);
      expect(val.sample).toBe(true);
    });

    await sleep(500);
    await store.get('sid-0', (err, val) => {
      expect(err).toBeUndefined();
      expect(val).toBeUndefined();
    });
  });

  it('should not get empty entry', async () => {
    store = await freshStore(prisma);

    await store.get('', (err, val) => {
      expect(err).toBeUndefined();
      expect(val).toBe(undefined);
    });
  });

  it('should not get a deleted entry', async () => {
    store = await freshStore(prisma);

    await store.set('sid-0', { cookie: {} });
    await store.get('sid-0', async (err, val) => {
      if (err) return err;
      expect(val).toBeTruthy();
      await store.destroy('sid-0');
      await store.get('sid-0', (err, val) => {
        if (err) return err;
        expect(val).toBeUndefined();
      });
    });
  });

  it('should not get an expired entry', async () => {
    store = await freshStore(prisma, { checkPeriod: 50 });

    await store.set('sid-0', { cookie: { maxAge: 200 }, sample: true });

    await sleep(500);

    await store.get('sid-0', (err, val) => {
      if (err) return err;
      expect(val).toBeUndefined();
    });
  });

  it('should enable automatic prune for expired entries', async () => {
    store = await freshStore(prisma, { checkPeriod: 100 });

    await store.set('sid-0', { cookie: { maxAge: 50 } });
    await store.set('sid-1', { cookie: { maxAge: 50 } });
    await store.length((err, count) => {
      if (err) return err;
      expect(count).toBe(2);
    });

    await sleep(300);

    await store.length((err, count) => {
      if (err) return err;
      expect(count).toBe(0);
    });
  });

  it('automatic check for expired entries should be disabled', async () => {
    store = await freshStore(prisma);

    await store.set('sid-0', { cookie: { maxAge: 150 } });
    await store.set('sid-1', { cookie: { maxAge: 150 } });
    await store.length((err, count) => {
      if (err) return err;
      expect(count).toBe(2);
    });

    await sleep(500);

    await store.length((err, count) => {
      if (err) return err;
      expect(count).toBe(2);
    });
  });

  it('should touch a given entry', async () => {
    store = await freshStore(prisma);

    await store.set('sid-0', { cookie: { maxAge: 50 } });
    await store.touch('sid-0', { cookie: { maxAge: 300 } });

    await sleep(200);

    await store.get('sid-0', (err, val) => {
      if (err) return err;
      expect(val).toBeTruthy();
    });
  });

  it('should fetch all entries Ids', async () => {
    store = await freshStore(prisma);

    const TEN = 10;
    for (const i of range(TEN)) {
      await store.set(`sid-${i}`, { cookie: { maxAge: 1000 } });
    }

    await store.ids((err, ids) => {
      if (err) return err;
      expect(Array.isArray(ids)).toBeTruthy();
      if (ids) {
        for (const i of range(ids.length)) {
          expect(ids[i]).toBe(`sid-${i}`);
        }
      }
    });
  });

  it('should fetch all entries values', async () => {
    store = await freshStore(prisma);

    const TEN = 10;
    for (const i of range(TEN)) {
      await store.set(`sid-${i}`, { cookie: { maxAge: 1000 }, i: i });
    }

    await store.all((err, all) => {
      if (err) return err;
      expect(typeof all).toBe('object');
      Object.keys(all).forEach((sid) => {
        const value = parseInt(sid.split('-')[1], 10);
        expect(all[sid].i).toBe(value);
      });
    });
  });

  it('should count all entries in the store', async () => {
    store = await freshStore(prisma);

    const TEN = 10;
    for (const i of range(TEN)) {
      await store.set(`sid-${i}`, { cookie: { maxAge: 1000 } });
    }

    await store.length((err, n) => {
      if (err) return err;
      expect(n).toBe(TEN);
    });
  });

  it('should delete all entries from the store', async () => {
    store = await freshStore(prisma);

    const TEN = 10;
    for (const i of range(TEN)) {
      await store.set(`sid${i}`, { cookie: { maxAge: 1000 } });
    }

    await store.length((err, n) => {
      if (err) return err;
      expect(n).toBe(TEN);
    });

    await store.clear();

    await store.length((err, n) => {
      if (err) return err;
      expect(n).toBe(0);
    });
  });
});
