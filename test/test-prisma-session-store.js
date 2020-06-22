const assert = require('assert')
const { PrismaClient } = require('./../../../@prisma/client')
//Note: You're @prisma/client may be located in a different place

const ilog = console.log; 
const elog = console.error;

const prisma = new PrismaClient()


// express-session style setup
const PrismaSessionStore = require('../')({Store: function () {}})
const session = { PrismaSessionStore }


const sleep = m => new Promise(r => setTimeout(r, m))


async function freshStore(f, prisma, options) {
  
  options = options || {}
  // If no dbRecordIdIsSessionId option given, and no dbRecordIdFunction given
  if ( (options.dbRecordIdIsSessionId==undefined || 
        options.dbRecordIdIsSessionId==null || 
        options.dbRecordIdIsSessionId=='') && !options.dbRecordIdFunction) {
    options.dbRecordIdIsSessionId = true
  }

  f.store = new session.PrismaSessionStore(prisma, options)
  const store = f.store

  await store.clear( async () => {
    let cleared = false
    while (!cleared) {
      //ilog('Waiting for db to clear...')
      //Ensure database has been cleared...
      await store.length( (err, length) => {
        if (err) return ilog(err)
        if (length === 0) {
          cleared = true;
        }
      })
    }
  })

  return store
}


describe('PrismaSessionStore', () => {


  afterEach( () => {
    // runs after each test in this block
    this.store.stopInterval()
  })


  it('constructor should use default options', async () => {

    const store = await freshStore(this, prisma)   

    assert.ok(store.options, 'should have an option object')
    assert.equal(store.options.checkPeriod, undefined, 'checkPeriod undefined by default')
    assert.ok(store.prisma, 'should have prisma client connection')
    assert.equal(store._checkInterval, undefined, 'should not have the pruning loop')
  })


  it('should set options', async () => {
    
    const store = await freshStore(this, prisma, {
      checkPeriod: 10 * 1000,
      ttl: 36000,
      dispose: null,
      stale: true
    })

    assert.equal(store.options.checkPeriod, 10 * 1000, 'should set checkPeriod')
    assert.equal(store.options.ttl, 36000, 'should set the TTL')
    assert.equal(store.options.dispose, null, 'should set dispose')
    assert.equal(store.options.stale, true, 'should set stale')
  })


  it('should not set the interval to check for expired entries by default', async () => {
    const store = await freshStore(this, prisma)

    assert.equal(store._checkInterval, undefined, 'should not exists')
  })


  it('should begin with no sessions in the database', async () => {
    const store = await freshStore(this, prisma)

    await store.length( (err, length) => {
      if (err) return err
      assert.equal(length, 0)
    })
  })


  it('should contain 10 items', async () => {
    const store = await freshStore(this, prisma)

    for (var i = 0; i < 10; i++) {
      let sid = ""+i
      await store.set(sid, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    store.length( (err, length) => {
      if (err) return err
      assert.equal(length, 10)
    })
  })


  it('should delete the first item', async () => {
    const store = await freshStore(this, prisma)

    for (var i = 0; i < 15; i++) {
      let sid = "sid-" + i
      await store.set(sid, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    await store.destroy('sid-0')

    await store.length( (err, length) => {
      if (err) return err;
      assert.equal(length, 14)
    })
  })


  it('should delete the last item', async () => {
    const store = await freshStore(this, prisma)

    for (var i = 0; i < 10; i++) {
      let sid = "sid-" + i
      await store.set(sid, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    await store.destroy('sid-9')

    await store.length( (err, length) => {
      if (err) return err
      assert.equal(length, 9)
    })

    for (i = 9; i < 12; i++) {
      let sid = "sid-" + i
      await store.set(sid, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    await store.length( (err, length) => {
      if (err) return err
      assert.equal(length, 12)
    })
  })


  it('should fail gracefully when attempting to delete non-existent item', async () => {
    const store = await freshStore(this, prisma)

    await store.destroy('sid-0')

    await store.length( (err, length) => {
      if (err) return err
      assert.equal(length, 0)
    })
  })


  it('should fail gracefully when attempting to get a non-existent entry', async () => {
    const store = await freshStore(this, prisma)

    await store.get('sid-0', (err, val) => {
      if (err) return err
      assert.equal(val, undefined, 'got undefined')
    })
  })


  it('should fail gracefully when attempting to touch a non-existent entry', async () => {
    const store = await freshStore(this, prisma)

    await store.touch('sid-0', {cookie: {maxAge: 300}}, (err, val) => {
      if (err) return err
    })
  })


  it('should set and get a sample entry', async () => {
    const store = await freshStore(this, prisma)

    await store.set('sid-0', {cookie: {}, sample: true})
    await store.get('sid-0', (err, val) => {
      if (err) return err
      assert.equal(val.sample, true, 'set and got expected value')
    })
  })


  it('should set TTL from cookie.maxAge', async () => {
    const store = await freshStore(this, prisma, { checkPeriod: 50})

    await store.set('sid-0', {cookie: {maxAge: 400}, sample: true})
    await store.get('sid-0', (err, val) => {
      if (err) return err
      assert.equal(val.sample, true, 'entry should be valid')
    })


    await sleep(500);
    await store.get('sid-0', (err, val) => {
      //ilog(val);
      //let expires = (new Date).valueOf() + val.cookie.maxAge
      //ilog('TEST() ' + 'expires:' + expires + ' now:' + (new Date).valueOf() );
      if (err) return err
      assert.equal(val, undefined, 'entry should be expired')
    })
  })


  it('should not get empty entry', async () => {
    const store = await freshStore(this, prisma)

    await store.get('', (err, val) => {
      if (err) return err
      assert.equal(val, undefined)
    })
  })


  it('should not get a deleted entry', async () => {
    const store = await freshStore(this, prisma)

    await store.set('sid-0', {cookie: {}})
    await store.get('sid-0', async (err, val) => {
      if (err) return err
      assert.ok(val, 'entry exists')
      await store.destroy('sid-0')
      await store.get('sid-0', (err, val) => {
        if (err) return err
        assert.equal(val, undefined, 'requested entry previously deleted')
      })
    })
  })


  it('should not get an expired entry', async () => {
    const store = await freshStore(this, prisma, {checkPeriod: 50})

    await store.set('sid-0', {cookie: {maxAge: 200}, sample: true})

    await sleep(500);

    await store.get('sid-0', (err, val) => {
      if (err) return err
      assert.equal(val, undefined, 'entry should be expired')
    })
  })


  it('should enable automatic prune for expired entries', async () => {

    const store = await freshStore(this, prisma, {checkPeriod: 100})

    await store.set('sid-0', {cookie: {maxAge: 50}})
    await store.set('sid-1', {cookie: {maxAge: 50}})
    await store.length( (err, count) => {
      if (err) return err
      assert.equal(count, 2, 'should count 2 entries')
    })

    await sleep(300)

    await store.length( (err, count) => {
      if (err) return err
      assert.equal(count, 0, 'expired entries should be pruned')
    })
  })


  it('automatic check for expired entries should be disabled', async () => {

    const store = await freshStore(this, prisma)

    await store.set('sid-0', {cookie: {maxAge: 150}})
    await store.set('sid-1', {cookie: {maxAge: 150}})
    await store.length( (err, count) => {
      if (err) return err
      assert.equal(count, 2, 'should count 2 entries')
    })

    await sleep(500)

    await store.length( (err, count) => {
      if (err) return err
      assert.equal(count, 2, 'expired entries should not be pruned')
      return
    })
  })


  it('should touch a given entry', async () => {
    const store = await freshStore(this, prisma)

    await store.set('sid-0', {cookie: {maxAge: 50}})
    await store.touch('sid-0', {cookie: {maxAge: 300}})

    await sleep(200)

    await store.get('sid-0', (err, val) => {
      if (err) return err
      assert.ok(val, 'entry should be touched')
    })
  })


  it('should fetch all entries Ids', async () => {
    const store = await freshStore(this, prisma)

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) {
      await store.set('sid-'+i, {cookie: {maxAge: 1000}})
    }

    await store.ids( (err, ids) => {
      if (err) return err
      assert.ok(Array.isArray(ids), 'ids should be an Array')
      for (let i=0; i<ids.length;i++) {
        assert.equal(ids[i], 'sid-'+(i), 'got expected key')
      } 
    })
  })


  it('should fetch all entries values', async () => {
    const store = await freshStore(this, prisma)

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { await store.set('sid-'+i, {cookie: {maxAge: 1000}, i: i}) }

    await store.all( (err, all) => {
      if (err) return err
      assert.equal(typeof all, 'object', 'all should be an Object')
      Object.keys(all).forEach( (sid) => {
        var v = sid.split('-')[1]
        assert.equal(all[sid].i, v, 'got expected value')
      })
    })
  })


  it('should count all entries in the store', async () => {
    const store = await freshStore(this, prisma)

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { await store.set('sid-'+i, {cookie: {maxAge: 1000}}) }

    await store.length( (err, n) => {
      if (err) return err
      assert.equal(n, k, 'Got expected length')
    })
  })


  it('should delete all entries from the store', async () => {
    const store = await freshStore(this, prisma)

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { await store.set('sid'+i, {cookie: {maxAge: 1000}}) }

    await store.length( (err, n) => {
      if (err) return err
      assert.equal(n, k, 'store is not empty')
    })
    await store.clear()
    await store.length( (err, n) => {
      if (err) return err
      assert.equal(n, 0, 'store should be empty')
    })
  })
})
