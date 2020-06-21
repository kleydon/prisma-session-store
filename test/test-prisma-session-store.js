const assert = require('assert')
const { PrismaClient } = require('./../../../@prisma/client')
//Note: You're @prisma/client may be located in a different place

const ilog = console.log; 
const elog = console.error;

const prisma = new PrismaClient()


// express-session style setup
const PrismaSessionStore = require('../')({Store: function () {}})
const session = { PrismaSessionStore }



async function freshStore(f, prisma, options) {
  
  options = options || {}
  // If no dbRecordIdIsSessionId option given, and no dbRecordIdFunction given
  if ( (options.dbRecordIdIsSessionId==undefined || 
        options.dbRecordIdIsSessionId==null || 
        options.dbRecordIdIsSessionId=='') && !options.dbRecordIdFunction) {
    options.dbRecordIdIsSessionId = true
  }

  f.store = new session.PrismaSessionStore(prisma, options)
  let store = f.store

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


describe('PrismaSessionStore', (done) => {


  afterEach( () => {
    // runs after each test in this block
    this.store.stopInterval()
  })


  it('constructor should use default options', async (done) => {
    const store = await freshStore(this, prisma)

    assert.ok(store.options, 'should have an option object')
    assert.equal(store.options.checkPeriod, undefined, 'checkPeriod undefined by default')
    assert.ok(store.prisma, 'should have prisma client connection')
    assert.equal(store._checkInterval, undefined, 'should not have the pruning loop')
    done()
  })


  it('should set options', async (done) => {
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
    done()
  })


  it('should not set the interval to check for expired entries by default', async (done) => {
    const store = await freshStore(this, prisma)

    assert.equal(store._checkInterval, undefined, 'should not exists')
    done()
  })


  it('should begin with no sessions in the database', async (done) => {
    const store = await freshStore(this, prisma)

    await store.length( (err, length) => {
      if (err) return done(err)
      assert.equal(length, 0)
    })

    done()
  })


  it('should contain 10 items', async (done) => {
    const store = await freshStore(this, prisma)

    for (var i = 0; i < 10; i++) {
      let sid = ""+i
      await store.set(sid, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    store.length( (err, length) => {
      if (err) return done(err)
      assert.equal(length, 10)
    })

    done()
  })


  it('should delete the first item', async (done) => {
    const store = await freshStore(this, prisma)

    for (var i = 0; i < 15; i++) {
      let sid = "sid-" + i
      await store.set(sid, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    await store.destroy('sid-0')

    await store.length( (err, length) => {
      if (err) return done(err)
      assert.equal(length, 14)
      done()
    })
  })


  it('should delete the last item', async (done) => {
    const store = await freshStore(this, prisma)

    for (var i = 0; i < 10; i++) {
      let sid = "sid-" + i
      await store.set(sid, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    await store.destroy('sid-9')

    await store.length( (err, length) => {
      if (err) return done(err)
      assert.equal(length, 9)
    })

    for (i = 9; i < 12; i++) {
      let sid = "sid-" + i
      await store.set(sid, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    await store.length( (err, length) => {
      if (err) return done(err)
      assert.equal(length, 12)
      done()
    })
  })


  it('should fail gracefully when attempting to delete non-existent item', async (done) => {
    const store = await freshStore(this, prisma)

    await store.destroy('sid-0')

    await store.length( (err, length) => {
      if (err) return done(err)
      assert.equal(length, 0)
      done()
    })
  })


  it('should fail gracefully when attempting to get a non-existent entry', async (done) => {
    const store = await freshStore(this, prisma)

    await store.get('sid-0', (err, val) => {
      if (err) return done(err)
      assert.equal(val, undefined, 'got undefined')
      done()
    })
  })


  it('should fail gracefully when attempting to touch a non-existent entry', async (done) => {
    const store = await freshStore(this, prisma)

    await store.touch('sid-0', {cookie: {maxAge: 300}}, (err, val) => {
      if (err) return done(err)
      done()
    })
  })


  it('should set and get a sample entry', async (done) => {
    const store = await freshStore(this, prisma)

    await store.set('sid-0', {cookie: {}, sample: true})
    await store.get('sid-0', (err, val) => {
      if (err) return done(err)
      assert.equal(val.sample, true, 'set and got expected value')
      done()
    })
  })


  it('should set TTL from cookie.maxAge', async (done) => {
    const store = await freshStore(this, prisma, { checkPeriod: 50})

    await store.set('sid-0', {cookie: {maxAge: 400}, sample: true})
    await store.get('sid-0', (err, val) => {
      if (err) return err
      assert.equal(val.sample, true, 'entry should be valid')
    })

    setTimeout(async () => {
      await store.get('sid-0', (err, val) => {

        //ilog(val);
        //let expires = (new Date).valueOf() + val.cookie.maxAge
        //ilog('TEST() ' + 'expires:' + expires + ' now:' + (new Date).valueOf() );

        if (err) return done(err)
        assert.equal(val, undefined, 'entry should be expired')
        done()
      })
    }, 500) //500
  })


  it('should not get empty entry', async (done) => {
    const store = await freshStore(this, prisma)

    await store.get('', (err, val) => {
      if (err) return done(err)
      assert.equal(val, undefined)
      done()
    })
  })


  it('should not get a deleted entry', async (done) => {
    const store = await freshStore(this, prisma)

    await store.set('sid-0', {cookie: {}})
    await store.get('sid-0', async (err, val) => {
      if (err) return done(err)
      assert.ok(val, 'entry exists')
      await store.destroy('sid-0')
      await store.get('sid-0', (err, val) => {
        if (err) return done(err)
        assert.equal(val, undefined, 'requested entry previously deleted')
        done()
      })
    })
  })


  it('should not get an expired entry', async (done) => {
    const store = await freshStore(this, prisma, {checkPeriod: 50})

    await store.set('sid-0', {cookie: {maxAge: 200}, sample: true})
    setTimeout(async () => {
      await store.get('sid-0', (err, val) => {
        if (err) return done(err)
        assert.equal(val, undefined, 'entry should be expired')
        done()
      })
    }, 300)
  })


  it('should enable automatic prune for expired entries', async (done) => {
    const store = await freshStore(this, prisma, {checkPeriod: 300})

    await store.set('sid-0', {cookie: {maxAge: 150}})
    await store.set('sid-1', {cookie: {maxAge: 150}})
    await store.length( (err, count) => {
      if (err) return done(err)
      assert.equal(count, 2, 'should count 2 entries')
    })
    setTimeout(async () => {
      await store.length( (err, count) => {
        if (err) return done(err)
        assert.equal(count, 0, 'expired entries should be pruned')
        done()
      })
    }, 500)
  })


  it('automatic check for expired entries should be disabled', async (done) => {
    const store = await freshStore(this, prisma)

    await store.set('sid-0', {cookie: {maxAge: 150}})
    await store.set('sid-1', {cookie: {maxAge: 150}})
    await store.length( (err, count) => {
      if (err) return done(err)
      assert.equal(count, 2, 'should count 2 entries')
    })
    setTimeout(async () => {
      await store.length( (err, count) => {
        if (err) return done(err)
        assert.equal(count, 2, 'expired entries should not be pruned')
        done()
      })
    }, 500)
  })


  it('should touch a given entry', async (done) => {
    const store = await freshStore(this, prisma)

    await store.set('sid-0', {cookie: {maxAge: 50}})
    await store.touch('sid-0', {cookie: {maxAge: 300}})
    setTimeout(async () => {
      await store.get('sid-0', (err, val) => {
        if (err) return done(err)
        assert.ok(val, 'entry should be touched')
        done()
      })
    }, 200)
  })


  it('should fetch all entries Ids', async (done) => {
    const store = await freshStore(this, prisma)

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) {
      await store.set('sid-'+i, {cookie: {maxAge: 1000}})
    }

    await store.ids( (err, ids) => {
      if (err) return done(err)

      assert.ok(Array.isArray(ids), 'ids should be an Array')
      
      for (let i=0; i<ids.length;i++) {
        assert.equal(ids[i], 'sid-'+(i), 'got expected key')
      } 
      done()
    })
  })


  it('should fetch all entries values', async (done) => {
    const store = await freshStore(this, prisma)

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { await store.set('sid-'+i, {cookie: {maxAge: 1000}, i: i}) }

    await store.all( (err, all) => {
      if (err) return done(err)
      assert.equal(typeof all, 'object', 'all should be an Object')
      Object.keys(all).forEach( (sid) => {
        var v = sid.split('-')[1]
        assert.equal(all[sid].i, v, 'got expected value')
      })
      done()
    })
  })


  it('should count all entries in the store', async (done) => {
    const store = await freshStore(this, prisma)

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { await store.set('sid-'+i, {cookie: {maxAge: 1000}}) }

    await store.length( (err, n) => {
      if (err) return done(err)
      assert.equal(n, k, 'Got expected lenght')
      done()
    })
  })


  it('should delete all entries from the store', async (done) => {
    const store = await freshStore(this, prisma)

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { await store.set('sid'+i, {cookie: {maxAge: 1000}}) }

    await store.length( (err, n) => {
      if (err) return done(err)
      assert.equal(n, k, 'store is not empty')
    })
    await store.clear()
    await store.length( (err, n) => {
      if (err) return done(err)
      assert.equal(n, 0, 'store should be empty')
      done()
    })
  })
})
