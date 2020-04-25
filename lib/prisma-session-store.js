var util = require('util')

const ilog = console.log; 
const elog = console.error;


/**
 * One day in milliseconds.
 */
const oneDay = 86400000


function getTTL(options, sess, sid) {

  if (typeof options.ttl === 'number') return options.ttl
  if (typeof options.ttl === 'function') return options.ttl(options, sess, sid)
  if (options.ttl) throw new TypeError('`options.ttl` must be a number or function.')

  const maxAge = (sess && sess.cookie) ? sess.cookie.maxAge : null
  return (typeof maxAge === 'number' ? Math.floor(maxAge) : oneDay)
}


async function prune(prisma) {

  // XXX More efficent way? Maybe when filtering is fully implemented? XXX

  ilog('Checking for any expired sessions...')

  const sessions = await prisma.session.findMany({
    select: {
      expires: true,
      sid: true
    }
  })

  for (let i = 0; i < sessions.length; i++) { 

    const s = sessions[i]
    const now = new Date()
    const remainingSec = ( s.expires.valueOf() - now.valueOf() ) / 1000

    ilog('session:' + s.sid + ' expires in ' + remainingSec + 'sec')

    if (now.valueOf() >= s.expires.valueOf()) {  

      ilog('Deleting session with sid: ' + s.sid)

      await prisma.session.delete({
        where: { sid: s.sid },
      })
    }
  }
}


var defer = typeof setImmediate === 'function' ? 
  setImmediate: (fn) => {
    process.nextTick(fn.bind.apply(fn, arguments))
  }


/**
 * Return the `PrismaSessionStore` extending `express`'s session Store.
 *
 * @param {object} express session
 * @return {Function}
 * @api public
 */
module.exports = (session) => {


  /**
   * Express's session Store.
   */
  const Store = session.Store


  /**
   * Initialize PrismaSessionStore with the given `prisma` and (optional) `options`.
   *
   * @param {PrismaClient} prisma
   * @param {Object} options
   * @api public
   */
  function PrismaSessionStore (prisma, options) {

    if (!(this instanceof PrismaSessionStore)) {
      throw new TypeError('Cannot call PrismaSessionStore constructor as a function')
    }

    options = options || {}

    Store.call(this, options)

    this.options = {}
    this.options.checkPeriod = options.checkPeriod
    this.options.ttl = options.ttl
    this.options.dispose = options.dispose
    this.options.stale = options.stale
    this.options.noDisposeOnSet = options.noDisposeOnSet

    this.serializer = options.serializer || JSON

    this.prisma = prisma

    this.dbRecordIdIsSessionId = options.dbRecordIdIsSessionId
    this.dbRecordIdFunction = options.dbRecordIdFunction
    
    this.startInterval()
  }


  /**
   * Inherit from `Store`.
   */
  util.inherits(PrismaSessionStore, Store)


  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */
  PrismaSessionStore.prototype.get = async function (sid, fn) {
    const prisma = this.prisma

    let session = null;
    try {
      session = await prisma.session.findOne({
        where: { sid },
      })
    }
    catch (e) { }

    if (!session) return fn()

    let err = null
    let result
    try {
      result = this.serializer.parse(session.data)
    } catch (e) {
      err = e
    }

    fn && defer(fn, err, result)
  }


  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */
  PrismaSessionStore.prototype.set = async function (sid, sess, fn) {
    const prisma = this.prisma
    const dbRecordIdFunction = this.dbRecordIdFunction
    const dbRecordIdIsSessionId = this.dbRecordIdIsSessionId

    const ttl = getTTL(this.options, sess, sid)
    const expires = new Date((new Date()).valueOf() + ttl)

    let jsess = null
    try {
      jsess = this.serializer.stringify(sess)
    } catch (e) {
      fn && defer(fn, e)
    }

    let data = {
      sid,
      data: jsess,
      expires
    }
    if (dbRecordIdIsSessionId) {
      data = {
        id: sid,
        ...data        
      }
    }
    else if (dbRecordIdFunction) {
      data = {
        id: dbRecordIdFunction(),
        ...data        
      }
    }
    
    
    //Update session if it exists, otherwise create it
    let existingSession = false
    try {
      existingSession = await prisma.session.findOne({
        where: { sid },
      })
    }
    catch (e) { }

    if (existingSession) {
      await prisma.session.update({
        where: { sid },
        data,
      })
    }
    else {
      await prisma.session.create({
        data,
      });
    }

    fn && defer(fn, null)
  }


  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */
  PrismaSessionStore.prototype.destroy = async function (sid, fn) {
    const prisma = this.prisma

    if (Array.isArray(sid)) {
      sid.forEach(async function (s) {
        try {
          await prisma.session.delete({ where: { sid } })
        } catch (e) {
          //ilog('Attempt to destroy non-existent session:' + sid + ' ' + e)
        }
      })
    } else {
      try {
        await prisma.session.delete({ where: { sid } })
      } catch (e) {
        //ilog('Attempt to destroy non-existent session:' + sid + ' ' + e)
      }
    }

    fn && defer(fn, null)
  }


  /**
   * Refresh the time-to-live for the session with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */
  PrismaSessionStore.prototype.touch = async function (sid, sess, fn) {
    const prisma = this.prisma

    const ttl = getTTL(this.options, sess, sid)
    const expires = new Date((new Date()).valueOf() + ttl)

    let err = null
    try {

      const existingSession = await prisma.session.findOne({
        where: { sid },
      })
  
      if (existingSession) {

        const existingSessionData = this.serializer.parse(existingSession.data)
        existingSessionData.cookie = sess.cookie
        
        await prisma.session.update({
          where: { sid: existingSession.sid},
          data: {
            sid,
            data: this.serializer.stringify(existingSessionData),
            expires
          }
        });
      }
    } catch (e) {
      ilog('touch(): ' + e)
      err = e
    }

    // *** If there is no found session, for some reason, should it be recreated from sess *** ?

    fn && defer(fn, err)
  }


  /**
   * Fetch all sessions' ids
   *
   * @param {Function} fn
   * @api public
   */
  PrismaSessionStore.prototype.ids = async function (fn) {
    const prisma = this.prisma

    //XXX More efficient way? XXX
  
    const sessions = await prisma.session.findMany({
      select: { sid: true },
    })
    let sids = []
    for (let i = 0; i < sessions.length; i++){ 
      sids[i] = sessions[i].sid
    } 

    fn && defer(fn, null, sids)
  }


  /**
   * Fetch all sessions
   *
   * @param {Function} fn
   * @api public
   */
  PrismaSessionStore.prototype.all = async function (fn) {
    const prisma = this.prisma
    const serializer = this.serializer

    let err = null
    let result = {}
    try {
      const sessions = await prisma.session.findMany()
      for (let i = 0; i < sessions.length; i++){
        const session = sessions[i]
        result[session.sid] = serializer.parse(session.data)
      }      
    } catch (e) {
      err = e
    }

    fn && defer(fn, err, result)
  }


  /**
   * Delete all sessions from the store
   *
   * @param {Function} fn
   * @api public
   */
  PrismaSessionStore.prototype.clear = async function (fn) {
    const prisma = this.prisma

    await prisma.session.deleteMany()

    fn && defer(fn, null)
  }


  /**
   * Get the count of all sessions in the store
   *
   * @param {Function} fn
   * @api public
   */
  PrismaSessionStore.prototype.length = async function (fn) {
    const prisma = this.prisma

    // XXX More efficient way? XXX

    const sessions = await prisma.session.findMany({
      select: { sid: true }, //Limit what gets sent back; can't be empty.
    })

    const itemCount = sessions.length

    fn && defer(fn, null, itemCount)
  }


  /**
   * Start the check interval
   * @api public
   */
  PrismaSessionStore.prototype.startInterval = function () {
    const prisma = this.prisma
    const ms = this.options.checkPeriod

    if (ms && typeof ms === 'number') {
      clearInterval(this._checkInterval)
      this._checkInterval = setInterval(function () {     
        prune(prisma) // Prunes all old entries
      }, Math.floor(ms))
    }
  }


  /**
   * Stop the check interval
   * @api public
   */
  PrismaSessionStore.prototype.stopInterval = function () {
    clearInterval(this._checkInterval)
  }


  /**
   * Remove only expired entries from the store
   * @api public
   */
  PrismaSessionStore.prototype.prune = function () {
    const prisma = this.prisma
    prune(prisma)
  }


  return PrismaSessionStore
}
