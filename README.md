# prisma-session-store

An  [express](https://github.com/expressjs)  session store implementation, for the [Prisma (2) Framework](https://github.com/prisma).

Want the flexibility and scalability of a Prisma GraphQL data layer, along with the optionality and maturity of the Express ecosystem - but concerned about [JWT](https://jwt.io) or [Paseto](https://paseto.io) tokens for session management (see cautions posted [here](https://paragonie.com/blog/2017/03/jwt-json-web-tokens-is-bad-standard-that-everyone-should-avoid), [here](http://cryto.net/%7Ejoepie91/blog/2016/06/19/stop-using-jwt-for-sessions-part-2-why-your-solution-doesnt-work/), [here](https://techblog.bozho.net/using-jwt-sessions/), [here](https://news.ycombinator.com/item?id=17877332), and [here](https://developer.okta.com/blog/2017/08/17/why-jwts-suck-as-session-tokens))?

 `prisma-session-store` simplifies access to tried-and-true express session management via Prisma's database client.

Based on: [memorystore](https://github.com/roccomuso/memorystore), by [roccomuso](https://github.com/roccomuso)

## Usage

```javascript

var expressSession = require('express-session')
var PrismaSessionStore = require('prisma-session-store')(expressSession)

...

app.use(
  session({
    cookie: { 
	    maxAge: 7 * 24 * 60 * 60 * 1000 // ms
    },
    secret: 'a santa at nasa',
    store: new PrismaSessionStore(
      prisma, 
      {
        checkPeriod: 2 * 60 * 1000,  //ms
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: null,
      }
    )
  })
)

...

```

## Setup

1. Install `prisma-session-store` (and `express-session`, if not already installed): 
`$ npm install prisma-session-store express-session`
2. From your **prisma.schema** file, include a session model:
```
model Session {
  id        String   @id
  sid       String   @unique 
  data      String
  expires   DateTime
}
```
3. Where types are defined, add a corresponding session type:
```
...

{
  name: 'Session',
  definition(t) {
    t.model.id();
    t.model.sid();
    t.model.data();
    t.model.expires();
  }
}
...

```

## Options

*  `checkPeriod` Interval, in ms, at which PrismaSessionStore will automatically remove expired sessions. Disabled by default; set to something reasonable.

*  `ttl` "Time to live", in ms; defines session expiration time. Defaults to session.maxAge (if set), or one day (if not set). May alternatively be set to a function, of the form `(options, sess, sessionID) => number`.

*  `dispose` Called on sessions when they are dropped. Handy if you want to close file descriptors or do other cleanup tasks when sessions are no longer accessible. Called with `key, value`. It's called *before* actually removing the item from the internal cache, so if you want to immediately put it back in, you'll have to do that in a `nextTick` or `setTimeout` callback or it won't do anything.

*  `stale` By default, if you set a `maxAge`, it'll only actually pull stale items out of the cache when you `get(key)`. (That is, it's not pre-emptively doing a `setTimeout` or anything.) If you set `stale:true`, it'll return the stale value before deleting it. If you don't set this, then it'll return `undefined` when you try to get a stale entry, as if it had already been deleted.

*  `noDisposeOnSet` By default, if you set a `dispose()` method, then it'll be called whenever a `set()` operation overwrites an existing key. If you set this option, `dispose()` will only be called when a key falls out of the cache, not when it is overwritten.

*  `serializer` An object containing `stringify` and `parse` methods compatible with Javascript's `JSON` to override the serializer used.
  

## Methods

`prisma-session-store` implements all the **required**, **recommended** and **optional** methods of the [express-session](https://github.com/expressjs/session#session-store-implementation) store, plus a few more:

*  `startInterval()` and `stopInterval()` methods to start/clear the automatic check for expired.
*  `prune()` that you can use to manually remove only the expired entries from the store.

 
# Author

 Krispin Leydon ([kleydon](https://github.com/kleydon)), based heavily on [memorystore](https://github.com/roccomuso/memorystore), by [roccomuso](https://github.com/roccomuso)
  

# License

MIT
