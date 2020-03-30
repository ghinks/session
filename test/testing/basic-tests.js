const {
  cookie,
  createServer,
  expires,
  shouldNotHaveHeader,
  shouldSetCookie,
} = require('../support/testUtils')

var after = require('after')
var assert = require('assert')
var request = require('supertest')
var session = require('../../index')

describe('basic tests', function(){
  it('should export constructors', function(){
    assert.strictEqual(typeof session.Session, 'function')
    assert.strictEqual(typeof session.Store, 'function')
    assert.strictEqual(typeof session.MemoryStore, 'function')
  })

  it('should do nothing if req.session exists', function(done){
    function setup (req) {
      req.session = {}
    }

    request(createServer(setup))
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, done)
  })

  it('should error without secret', function(done){
    request(createServer({ secret: undefined }))
      .get('/')
      .expect(500, /secret.*required/, done)
  })

  it('should get secret from req.secret', function(done){
    function setup (req) {
      req.secret = 'keyboard cat'
    }

    request(createServer(setup, { secret: undefined }))
      .get('/')
      .expect(200, '', done)
  })

  it('should create a new session', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.session.active = true
      res.end('session active')
    });

    request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session active', function (err, res) {
        if (err) return done(err)
        store.length(function (err, len) {
          if (err) return done(err)
          assert.strictEqual(len, 1)
          done()
        })
      })
  })

  it('should load session from cookie sid', function (done) {
    var count = 0
    var server = createServer(null, function (req, res) {
      req.session.num = req.session.num || ++count
      res.end('session ' + req.session.num)
    });

    request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'session 1', done)
      })
  })

  it('should pass session fetch error', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      res.end('hello, world')
    })

    store.get = function destroy(sid, callback) {
      callback(new Error('boom!'))
    }

    request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'hello, world', function (err, res) {
        if (err) return done(err)
        request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(500, 'boom!', done)
      })
  })

  it('should treat ENOENT session fetch error as not found', function (done) {
    var count = 0
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.session.num = req.session.num || ++count
      res.end('session ' + req.session.num)
    })

    store.get = function destroy(sid, callback) {
      var err = new Error('boom!')
      err.code = 'ENOENT'
      callback(err)
    }

    request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'session 2', done)
      })
  })

  it('should create multiple sessions', function (done) {
    var cb = after(2, check)
    var count = 0
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      var isnew = req.session.num === undefined
      req.session.num = req.session.num || ++count
      res.end('session ' + (isnew ? 'created' : 'updated'))
    });

    function check(err) {
      if (err) return done(err)
      store.all(function (err, sess) {
        if (err) return done(err)
        assert.strictEqual(Object.keys(sess).length, 2)
        done()
      })
    }

    request(server)
      .get('/')
      .expect(200, 'session created', cb)

    request(server)
      .get('/')
      .expect(200, 'session created', cb)
  })

  it('should handle empty req.url', function (done) {
    function setup (req) {
      req.url = ''
    }

    request(createServer(setup))
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done)
  })

  it('should handle multiple res.end calls', function(done){
    var server = createServer(null, function (req, res) {
      res.setHeader('Content-Type', 'text/plain')
      res.end('Hello, world!')
      res.end()
    })

    request(server)
      .get('/')
      .expect('Content-Type', 'text/plain')
      .expect(200, 'Hello, world!', done);
  })

  it('should handle res.end(null) calls', function (done) {
    var server = createServer(null, function (req, res) {
      res.end(null)
    })

    request(server)
      .get('/')
      .expect(200, '', done)
  })

  it('should handle reserved properties in storage', function (done) {
    var count = 0
    var sid
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      sid = req.session.id
      req.session.num = req.session.num || ++count
      res.end('session saved')
    })

    request(server)
      .get('/')
      .expect(200, 'session saved', function (err, res) {
        if (err) return done(err)
        store.get(sid, function (err, sess) {
          if (err) return done(err)
          // save is reserved
          sess.save = 'nope'
          store.set(sid, sess, function (err) {
            if (err) return done(err)
            request(server)
              .get('/')
              .set('Cookie', cookie(res))
              .expect(200, 'session saved', done)
          })
        })
      })
  })

  it('should only have session data enumerable (and cookie)', function (done) {
    var server = createServer(null, function (req, res) {
      req.session.test1 = 1
      req.session.test2 = 'b'
      res.end(Object.keys(req.session).sort().join(','))
    })

    request(server)
      .get('/')
      .expect(200, 'cookie,test1,test2', done)
  })

  it('should not save with bogus req.sessionID', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.sessionID = function () {}
      req.session.test1 = 1
      req.session.test2 = 'b'
      res.end()
    })

    request(server)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, function (err) {
        if (err) return done(err)
        store.length(function (err, length) {
          if (err) return done(err)
          assert.strictEqual(length, 0)
          done()
        })
      })
  })

  it('should update cookie expiration when slow write', function (done) {
    var server = createServer({ rolling: true }, function (req, res) {
      req.session.user = 'bob'
      res.write('hello, ')
      setTimeout(function () {
        res.end('world!')
      }, 200)
    })

    request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function (err, res) {
        if (err) return done(err);
        var originalExpires = expires(res);
        setTimeout(function () {
          request(server)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(shouldSetCookie('connect.sid'))
            .expect(function (res) { assert.notStrictEqual(originalExpires, expires(res)); })
            .expect(200, done);
        }, (1000 - (Date.now() % 1000) + 200));
      });
  });
})

