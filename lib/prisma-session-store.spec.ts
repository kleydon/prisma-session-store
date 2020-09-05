import { PrismaClient } from '@prisma/client';

import prismSessionStore from './prisma-session-store';
import { MockStore } from './mocks/store.mock';
import { Options, Prisma } from './@types';

const prisma = new PrismaClient();
const PrismaSessionStore = prismSessionStore({ Store: MockStore });

const sleep = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

async function freshStore(prisma: Prisma, options: Options = {}) {
  // If no dbRecordIdIsSessionId option given, and no dbRecordIdFunction given
  if (!options.dbRecordIdIsSessionId && !options.dbRecordIdFunction) {
    options.dbRecordIdIsSessionId = true;
  }

  const store = new PrismaSessionStore(prisma, {
    logger: false,
    dbRecordIdIsSessionId: !options.dbRecordIdFunction,
    ...options,
  });

  await store.clear(async () => {
    let cleared = false;
    while (!cleared) {
      //console.log('Waiting for db to clear...')
      //Ensure database has been cleared...
      await store.length((err, length) => {
        if (err) return console.log(err);
        if (length === 0) cleared = true;
      });
    }
  });

  return store;
}

describe('PrismaSessionStore', () => {
  let store: typeof PrismaSessionStore.prototype;

  afterEach(() => {
    store.stopInterval();
    store.shutdown();
  });

  it('constructor should use default options', async () => {
    store = await freshStore(prisma);
    expect(store.options).toBeTruthy();
    expect(store.options.checkPeriod).toBeUndefined();
    expect(store.prisma).toBeTruthy();
    expect(store._checkInterval).toBeUndefined();
  });

  it('should set options', async () => {
    store = await freshStore(prisma, {
      checkPeriod: 10 * 1000,
      ttl: 36000,
      dispose: null,
      stale: true,
    });

    expect(store.options.checkPeriod).toBe(10 * 1000);
    expect(store.options.ttl).toBe(36000);
    expect(store.options.dispose).toBe(null);
    expect(store.options.stale).toBe(true);
  });

  it('should not set the interval to check for expired entries by default', async () => {
    store = await freshStore(prisma);

    expect(store._checkInterval).toBe(undefined);
  });

  it('should begin with no sessions in the database', async () => {
    store = await freshStore(prisma);

    await store.length((err, length) => {
      if (err) return err;
      expect(length).toBe(0);
    });
  });

  it('should contain 10 items', async () => {
    store = await freshStore(prisma);

    for (let i = 0; i < 10; i++) {
      let sid = '' + i;
      await store.set(sid, {
        cookie: { expires: new Date(new Date().valueOf() + 60 * 10 * 1000) },
      });
    }

    store.length((err, length) => {
      if (err) return err;
      expect(length).toBe(10);
    });
  });

  it('should delete the first item', async () => {
    store = await freshStore(prisma);

    for (var i = 0; i < 15; i++) {
      let sid = 'sid-' + i;
      await store.set(sid, {
        cookie: { expires: new Date(new Date().valueOf() + 60 * 10 * 1000) },
      });
    }

    await store.destroy('sid-0');

    await store.length((err, length) => {
      if (err) return err;
      expect(length).toBe(14);
    });
  });

  it('should delete the last item', async () => {
    store = await freshStore(prisma);

    for (var i = 0; i < 10; i++) {
      let sid = 'sid-' + i;
      await store.set(sid, {
        cookie: { expires: new Date(new Date().valueOf() + 60 * 10 * 1000) },
      });
    }

    await store.destroy('sid-9');

    await store.length((err, length) => {
      if (err) return err;
      expect(length).toBe(9);
    });

    for (i = 9; i < 12; i++) {
      let sid = 'sid-' + i;
      await store.set(sid, {
        cookie: { expires: new Date(new Date().valueOf() + 60 * 10 * 1000) },
      });
    }

    await store.length((err, length) => {
      if (err) return err;
      expect(length).toBe(12);
    });
  });

  it('should fail gracefully when attempting to delete non-existent item', async () => {
    store = await freshStore(prisma);

    await store.destroy('sid-0');

    await store.length((err, length) => {
      if (err) return err;
      expect(length).toBe(0);
    });
  });

  it('should fail gracefully when attempting to get a non-existent entry', async () => {
    store = await freshStore(prisma);

    await store.get('sid-0', (err, val) => {
      if (err) return err;
      expect(val).toBeUndefined();
    });
  });

  it('should fail gracefully when attempting to touch a non-existent entry', async () => {
    store = await freshStore(prisma);

    await store.touch('sid-0', { cookie: { maxAge: 300 } }, (err, val) => {
      if (err) return err;
    });
  });

  it('should set and get a sample entry', async () => {
    store = await freshStore(prisma);

    await store.set('sid-0', { cookie: {}, sample: true });
    await store.get('sid-0', (err, val) => {
      if (err) return err;
      expect(val.sample).toBe(true);
    });
  });

  it('should set TTL from cookie.maxAge', async () => {
    store = await freshStore(prisma, { checkPeriod: 50 });

    await store.set('sid-0', { cookie: { maxAge: 400 }, sample: true });
    await store.get('sid-0', (err, val) => {
      if (err) return err;
      expect(val.sample).toBe(true);
    });

    await sleep(500);
    await store.get('sid-0', (err, val) => {
      //console.log(val);
      //let expires = (new Date).valueOf() + val.cookie.maxAge
      //console.log('TEST() ' + 'expires:' + expires + ' now:' + (new Date).valueOf() );
      if (err) return err;
      expect(val).toBeUndefined();
    });
  });

  it('should not get empty entry', async () => {
    store = await freshStore(prisma);

    await store.get('', (err, val) => {
      if (err) return err;
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

    var k = 10;
    var i = 0;
    for (i = 0; i < k; i++) {
      await store.set('sid-' + i, { cookie: { maxAge: 1000 } });
    }

    await store.ids((err, ids) => {
      if (err) return err;
      expect(Array.isArray(ids)).toBeTruthy();
      for (let i = 0; i < ids.length; i++) {
        expect(ids[i]).toBe(`sid-${i}`);
      }
    });
  });

  it('should fetch all entries values', async () => {
    store = await freshStore(prisma);

    const TEN = 10;
    for (let i = 0; i < TEN; i++) {
      await store.set('sid-' + i, { cookie: { maxAge: 1000 }, i: i });
    }

    await store.all((err, all) => {
      if (err) return err;
      expect(typeof all).toBe('object');
      Object.keys(all).forEach((sid) => {
        const v = parseInt(sid.split('-')[1], 10);
        expect(all[sid].i).toBe(v);
      });
    });
  });

  it('should count all entries in the store', async () => {
    store = await freshStore(prisma);

    const TEN = 10;
    for (let i = 0; i < TEN; i++) {
      await store.set('sid-' + i, { cookie: { maxAge: 1000 } });
    }

    await store.length((err, n) => {
      if (err) return err;
      expect(n).toBe(TEN);
    });
  });

  it('should delete all entries from the store', async () => {
    store = await freshStore(prisma);

    const TEN = 10;
    for (let i = 0; i < TEN; i++) {
      await store.set('sid' + i, { cookie: { maxAge: 1000 } });
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
