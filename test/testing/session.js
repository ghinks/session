const {
  cookie,
  createServer,
  createRequestListener,
  createSession,
  end,
  expires,
  mountAt,
  shouldNotHaveHeader,
  shouldSetCookie,
  shouldSetCookieToDifferentSessionId,
  shouldNotSetSessionInStore,
  shouldSetCookieToExpireIn,
  shouldSetCookieToValue,
  shouldSetCookieWithAttribute,
  shouldSetCookieWithAttributeAndValue,
  shouldSetCookieWithoutAttribute,
  shouldSetSessionInStore,
  sid
} = require('../support/testUtils')

var after = require('after')
var assert = require('assert')
var cookieParser = require('cookie-parser')
var express = require('express')
var fs = require('fs')
var http = require('http')
var https = require('https')
var request = require('supertest')
var session = require('../../index')
var SmartStore = require('../support/smart-store')
var SyncStore = require('../support/sync-store')
var utils = require('../support/utils')
var path = require('path')

var Cookie = require('../../session/cookie')

var min = 60 * 1000;

describe('session()', function(){
  describe('when response ended', function () {
    it('should have saved session', function (done) {
      var saved = false
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.end('session saved')
      })

      var _set = store.set
      store.set = function set(sid, sess, callback) {
        setTimeout(function () {
          _set.call(store, sid, sess, function (err) {
            saved = true
            callback(err)
          })
        }, 200)
      }

      request(server)
      .get('/')
      .expect(200, 'session saved', function (err) {
        if (err) return done(err)
        assert.ok(saved)
        done()
      })
    })

    it('should have saved session even with empty response', function (done) {
      var saved = false
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '0')
        res.end()
      })

      var _set = store.set
      store.set = function set(sid, sess, callback) {
        setTimeout(function () {
          _set.call(store, sid, sess, function (err) {
            saved = true
            callback(err)
          })
        }, 200)
      }

      request(server)
      .get('/')
      .expect(200, '', function (err) {
        if (err) return done(err)
        assert.ok(saved)
        done()
      })
    })

    it('should have saved session even with multi-write', function (done) {
      var saved = false
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '12')
        res.write('hello, ')
        res.end('world')
      })

      var _set = store.set
      store.set = function set(sid, sess, callback) {
        setTimeout(function () {
          _set.call(store, sid, sess, function (err) {
            saved = true
            callback(err)
          })
        }, 200)
      }

      request(server)
      .get('/')
      .expect(200, 'hello, world', function (err) {
        if (err) return done(err)
        assert.ok(saved)
        done()
      })
    })

    it('should have saved session even with non-chunked response', function (done) {
      var saved = false
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '13')
        res.end('session saved')
      })

      var _set = store.set
      store.set = function set(sid, sess, callback) {
        setTimeout(function () {
          _set.call(store, sid, sess, function (err) {
            saved = true
            callback(err)
          })
        }, 200)
      }

      request(server)
      .get('/')
      .expect(200, 'session saved', function (err) {
        if (err) return done(err)
        assert.ok(saved)
        done()
      })
    })

    it('should have saved session with updated cookie expiration', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ cookie: { maxAge: min }, store: store }, function (req, res) {
        req.session.user = 'bob'
        res.end(req.session.id)
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function (err, res) {
        if (err) return done(err)
        var id = res.text
        store.get(id, function (err, sess) {
          if (err) return done(err)
          assert.ok(sess, 'session saved to store')
          var exp = new Date(sess.cookie.expires)
          assert.strictEqual(exp.toUTCString(), expires(res))
          setTimeout(function () {
            request(server)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(200, function (err, res) {
              if (err) return done(err)
              store.get(id, function (err, sess) {
                if (err) return done(err)
                assert.strictEqual(res.text, id)
                assert.ok(sess, 'session still in store')
                assert.notStrictEqual(new Date(sess.cookie.expires).toUTCString(), exp.toUTCString(), 'session cookie expiration updated')
                done()
              })
            })
          }, (1000 - (Date.now() % 1000) + 200))
        })
      })
    })
  })

  describe('when session expired in store', function () {
    it('should create a new session', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store, cookie: { maxAge: 5 } }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      });

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        setTimeout(function () {
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, 'session 2', done)
        }, 20)
      })
    })

    it('should have a new sid', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store, cookie: { maxAge: 5 } }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      });

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        setTimeout(function () {
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(shouldSetCookieToDifferentSessionId(sid(res)))
          .expect(200, 'session 2', done)
        }, 15)
      })
    })

    it('should not exist in store', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store, cookie: { maxAge: 5 } }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      });

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        setTimeout(function () {
          store.all(function (err, sess) {
            if (err) return done(err)
            assert.strictEqual(Object.keys(sess).length, 0)
            done()
          })
        }, 10)
      })
    })
  })

  describe('when session without cookie property in store', function () {
    it('should pass error from inflate', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        store.set(sid(res), { foo: 'bar' }, function (err) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(500, /Cannot read property/, done)
        })
      })
    })
  })

  describe('key option', function(){
    it('should default to "connect.sid"', function(done){
      request(createServer())
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done)
    })

    it('should allow overriding', function(done){
      request(createServer({ key: 'session_id' }))
      .get('/')
      .expect(shouldSetCookie('session_id'))
      .expect(200, done)
    })
  })

  describe('rolling option', function(){
    it('should default to false', function(done){
      var server = createServer(null, function (req, res) {
        req.session.user = 'bob'
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function(err, res){
        if (err) return done(err);
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      });
    });

    it('should force cookie on unmodified session', function(done){
      var server = createServer({ rolling: true }, function (req, res) {
        req.session.user = 'bob'
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function(err, res){
        if (err) return done(err);
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
      });
    });

    it('should not force cookie on uninitialized session if saveUninitialized option is set to false', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, rolling: true, saveUninitialized: false })

      request(server)
      .get('/')
      .expect(shouldNotSetSessionInStore(store))
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, done)
    });

    it('should force cookie and save uninitialized session if saveUninitialized option is set to true', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, rolling: true, saveUninitialized: true })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done)
    });

    it('should force cookie and save modified session even if saveUninitialized option is set to false', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, rolling: true, saveUninitialized: false }, function (req, res) {
        req.session.user = 'bob'
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });
  });

  describe('resave option', function(){
    it('should default to true', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.user = 'bob'
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(200, function(err, res){
        if (err) return done(err);
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldSetSessionInStore(store))
        .expect(200, done);
      });
    });

    describe('when true', function () {
      it('should force save on unmodified session', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: true }, function (req, res) {
          req.session.user = 'bob'
          res.end()
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetSessionInStore(store))
          .expect(200, done)
        })
      })
    })

    describe('when false', function () {
      it('should prevent save on unmodified session', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: false }, function (req, res) {
          req.session.user = 'bob'
          res.end()
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldNotSetSessionInStore(store))
          .expect(200, done)
        })
      })

      it('should still save modified session', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ resave: false, store: store }, function (req, res) {
          if (req.method === 'PUT') {
            req.session.token = req.url.substr(1)
          }
          res.end('token=' + (req.session.token || ''))
        })

        request(server)
        .put('/w6RHhwaA')
        .expect(200)
        .expect(shouldSetSessionInStore(store))
        .expect('token=w6RHhwaA')
        .end(function (err, res) {
          if (err) return done(err)
          var sess = cookie(res)
          request(server)
          .get('/')
          .set('Cookie', sess)
          .expect(200)
          .expect(shouldNotSetSessionInStore(store))
          .expect('token=w6RHhwaA')
          .end(function (err) {
            if (err) return done(err)
            request(server)
            .put('/zfQ3rzM3')
            .set('Cookie', sess)
            .expect(200)
            .expect(shouldSetSessionInStore(store))
            .expect('token=zfQ3rzM3')
            .end(done)
          })
        })
      })

      it('should detect a "cookie" property as modified', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: false }, function (req, res) {
          req.session.user = req.session.user || {}
          req.session.user.name = 'bob'
          req.session.user.cookie = req.session.user.cookie || 0
          req.session.user.cookie++
          res.end()
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetSessionInStore(store))
          .expect(200, done)
        })
      })

      it('should pass session touch error', function (done) {
        var cb = after(2, done)
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: false }, function (req, res) {
          req.session.hit = true
          res.end('session saved')
        })

        store.touch = function touch (sid, sess, callback) {
          callback(new Error('boom!'))
        }

        server.on('error', function onerror (err) {
          assert.ok(err)
          assert.strictEqual(err.message, 'boom!')
          cb()
        })

        request(server)
        .get('/')
        .expect(200, 'session saved', function (err, res) {
          if (err) return cb(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .end(cb)
        })
      })
    })
  });

  describe('saveUninitialized option', function(){
    it('should default to true', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });

    it('should force save of uninitialized session', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, saveUninitialized: true })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });

    it('should prevent save of uninitialized session', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, saveUninitialized: false })

      request(server)
      .get('/')
      .expect(shouldNotSetSessionInStore(store))
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, done)
    });

    it('should still save modified session', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, saveUninitialized: false }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });

    it('should pass session save error', function (done) {
      var cb = after(2, done)
      var store = new session.MemoryStore()
      var server = createServer({ store: store, saveUninitialized: true }, function (req, res) {
        res.end('session saved')
      })

      store.set = function destroy(sid, sess, callback) {
        callback(new Error('boom!'))
      }

      server.on('error', function onerror(err) {
        assert.ok(err)
        assert.strictEqual(err.message, 'boom!')
        cb()
      })

      request(server)
      .get('/')
      .expect(200, 'session saved', cb)
    })

    it('should prevent uninitialized session from being touched', function (done) {
      var cb = after(1, done)
      var store = new session.MemoryStore()
      var server = createServer({ saveUninitialized: false, store: store, cookie: { maxAge: min } }, function (req, res) {
        res.end()
      })

      store.touch = function () {
        cb(new Error('should not be called'))
      }

      request(server)
      .get('/')
      .expect(200, cb)
    })
  });

  describe('unset option', function () {
    it('should reject unknown values', function(){
      assert.throws(session.bind(null, { unset: 'bogus!' }), /unset.*must/)
    });

    it('should default to keep', function(done){
      var store = new session.MemoryStore();
      var server = createServer({ store: store }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        if (req.session.count === 2) req.session = null
        res.end()
      })

      request(server)
      .get('/')
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.strictEqual(len, 1)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, function(err, res){
            if (err) return done(err);
            store.length(function(err, len){
              if (err) return done(err);
              assert.strictEqual(len, 1)
              done();
            });
          });
        });
      });
    });

    it('should allow destroy on req.session = null', function(done){
      var store = new session.MemoryStore();
      var server = createServer({ store: store, unset: 'destroy' }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        if (req.session.count === 2) req.session = null
        res.end()
      })

      request(server)
      .get('/')
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.strictEqual(len, 1)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, function(err, res){
            if (err) return done(err);
            store.length(function(err, len){
              if (err) return done(err);
              assert.strictEqual(len, 0)
              done();
            });
          });
        });
      });
    });

    it('should not set cookie if initial session destroyed', function(done){
      var store = new session.MemoryStore();
      var server = createServer({ store: store, unset: 'destroy' }, function (req, res) {
        req.session = null
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.strictEqual(len, 0)
          done();
        });
      });
    });

    it('should pass session destroy error', function (done) {
      var cb = after(2, done)
      var store = new session.MemoryStore()
      var server = createServer({ store: store, unset: 'destroy' }, function (req, res) {
        req.session = null
        res.end('session destroyed')
      })

      store.destroy = function destroy(sid, callback) {
        callback(new Error('boom!'))
      }

      server.on('error', function onerror(err) {
        assert.ok(err)
        assert.strictEqual(err.message, 'boom!')
        cb()
      })

      request(server)
      .get('/')
      .expect(200, 'session destroyed', cb)
    })
  });

  describe('res.end patch', function () {
    it('should correctly handle res.end/res.write patched prior', function (done) {
      function setup (req, res) {
        utils.writePatch(res)
      }

      function respond (req, res) {
        req.session.hit = true
        res.write('hello, ')
        res.end('world')
      }

      request(createServer(setup, null, respond))
      .get('/')
      .expect(200, 'hello, world', done)
    })

    it('should correctly handle res.end/res.write patched after', function (done) {
      function respond (req, res) {
        utils.writePatch(res)
        req.session.hit = true
        res.write('hello, ')
        res.end('world')
      }

      request(createServer(null, respond))
      .get('/')
      .expect(200, 'hello, world', done)
    })
  })

  describe('req.session', function(){
    it('should persist', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        res.end('hits: ' + req.session.count)
      })

      request(server)
      .get('/')
      .expect(200, 'hits: 1', function (err, res) {
        if (err) return done(err)
        store.load(sid(res), function (err, sess) {
          if (err) return done(err)
          assert.ok(sess)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'hits: 2', done)
        })
      })
    })

    it('should only set-cookie when modified', function(done){
      var modify = true;
      var server = createServer(null, function (req, res) {
        if (modify) {
          req.session.count = req.session.count || 0
          req.session.count++
        }
        res.end(req.session.count.toString())
      })

      request(server)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, '2', function (err, res) {
          if (err) return done(err)
          var val = cookie(res);
          modify = false;

          request(server)
          .get('/')
          .set('Cookie', val)
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, '2', function (err, res) {
            if (err) return done(err)
            modify = true;

            request(server)
            .get('/')
            .set('Cookie', val)
            .expect(shouldSetCookie('connect.sid'))
            .expect(200, '3', done)
          });
        });
      });
    })

    it('should not have enumerable methods', function (done) {
      var server = createServer(null, function (req, res) {
        req.session.foo = 'foo'
        req.session.bar = 'bar'
        var keys = []
        for (var key in req.session) {
          keys.push(key)
        }
        res.end(keys.sort().join(','))
      })

      request(server)
      .get('/')
      .expect(200, 'bar,cookie,foo', done);
    });

    it('should not be set if store is disconnected', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        res.end(typeof req.session)
      })

      store.emit('disconnect')

      request(server)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, 'undefined', done)
    })

    it('should be set when store reconnects', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        res.end(typeof req.session)
      })

      store.emit('disconnect')

      request(server)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, 'undefined', function (err) {
        if (err) return done(err)

        store.emit('connect')

        request(server)
        .get('/')
        .expect(200, 'object', done)
      })
    })

    describe('.destroy()', function(){
      it('should destroy the previous session', function(done){
        var server = createServer(null, function (req, res) {
          req.session.destroy(function (err) {
            if (err) res.statusCode = 500
            res.end(String(req.session))
          })
        })

        request(server)
        .get('/')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, 'undefined', done)
      })
    })

    describe('.regenerate()', function(){
      it('should destroy/replace the previous session', function(done){
        var server = createServer(null, function (req, res) {
          var id = req.session.id
          req.session.regenerate(function (err) {
            if (err) res.statusCode = 500
            res.end(String(req.session.id === id))
          })
        })

        request(server)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(shouldSetCookieToDifferentSessionId(sid(res)))
          .expect(200, 'false', done)
        });
      })
    })

    describe('.reload()', function () {
      it('should reload session from store', function (done) {
        var server = createServer(null, function (req, res) {
          if (req.url === '/') {
            req.session.active = true
            res.end('session created')
            return
          }

          req.session.url = req.url

          if (req.url === '/bar') {
            res.end('saw ' + req.session.url)
            return
          }

          request(server)
          .get('/bar')
          .set('Cookie', val)
          .expect(200, 'saw /bar', function (err, resp) {
            if (err) return done(err)
            req.session.reload(function (err) {
              if (err) return done(err)
              res.end('saw ' + req.session.url)
            })
          })
        })
        var val

        request(server)
        .get('/')
        .expect(200, 'session created', function (err, res) {
          if (err) return done(err)
          val = cookie(res)
          request(server)
          .get('/foo')
          .set('Cookie', val)
          .expect(200, 'saw /bar', done)
        })
      })

      it('should error is session missing', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          if (req.url === '/') {
            req.session.active = true
            res.end('session created')
            return
          }

          store.clear(function (err) {
            if (err) return done(err)
            req.session.reload(function (err) {
              res.statusCode = err ? 500 : 200
              res.end(err ? err.message : '')
            })
          })
        })

        request(server)
        .get('/')
        .expect(200, 'session created', function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/foo')
          .set('Cookie', cookie(res))
          .expect(500, 'failed to load session', done)
        })
      })
    })

    describe('.save()', function () {
      it('should save session to store', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          req.session.hit = true
          req.session.save(function (err) {
            if (err) return res.end(err.message)
            store.get(req.session.id, function (err, sess) {
              if (err) return res.end(err.message)
              res.end(sess ? 'stored' : 'empty')
            })
          })
        })

        request(server)
        .get('/')
        .expect(200, 'stored', done)
      })

      it('should prevent end-of-request save', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          req.session.hit = true
          req.session.save(function (err) {
            if (err) return res.end(err.message)
            res.end('saved')
          })
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, 'saved', function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetSessionInStore(store))
          .expect(200, 'saved', done)
        })
      })

      it('should prevent end-of-request save on reloaded session', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          req.session.hit = true
          req.session.reload(function () {
            req.session.save(function (err) {
              if (err) return res.end(err.message)
              res.end('saved')
            })
          })
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, 'saved', function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetSessionInStore(store))
          .expect(200, 'saved', done)
        })
      })
    })

    describe('.touch()', function () {
      it('should reset session expiration', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ resave: false, store: store, cookie: { maxAge: min } }, function (req, res) {
          req.session.hit = true
          req.session.touch()
          res.end()
        })

        request(server)
        .get('/')
        .expect(200, function (err, res) {
          if (err) return done(err)
          var id = sid(res)
          store.get(id, function (err, sess) {
            if (err) return done(err)
            var exp = new Date(sess.cookie.expires)
            setTimeout(function () {
              request(server)
              .get('/')
              .set('Cookie', cookie(res))
              .expect(200, function (err, res) {
                if (err) return done(err);
                store.get(id, function (err, sess) {
                  if (err) return done(err)
                  assert.notStrictEqual(new Date(sess.cookie.expires).getTime(), exp.getTime())
                  done()
                })
              })
            }, 100)
          })
        })
      })
    })

    describe('.cookie', function(){
      describe('.*', function(){
        it('should serialize as parameters', function(done){
          var server = createServer({ proxy: true }, function (req, res) {
            req.session.cookie.httpOnly = false
            req.session.cookie.secure = true
            res.end()
          })

          request(server)
          .get('/')
          .set('X-Forwarded-Proto', 'https')
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'HttpOnly'))
          .expect(shouldSetCookieWithAttribute('connect.sid', 'Secure'))
          .expect(200, done)
        })

        it('should default to a browser-session length cookie', function(done){
          request(createServer({ cookie: { path: '/admin' } }))
          .get('/admin')
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Expires'))
          .expect(200, done)
        })

        it('should Set-Cookie only once for browser-session cookies', function(done){
          var server = createServer({ cookie: { path: '/admin' } })

          request(server)
          .get('/admin/foo')
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, function (err, res) {
            if (err) return done(err)
            request(server)
            .get('/admin')
            .set('Cookie', cookie(res))
            .expect(shouldNotHaveHeader('Set-Cookie'))
            .expect(200, done)
          });
        })

        it('should override defaults', function(done){
          var server = createServer({ cookie: { path: '/admin', httpOnly: false, secure: true, maxAge: 5000 } }, function (req, res) {
            req.session.cookie.secure = false
            res.end()
          })

          request(server)
          .get('/admin')
          .expect(shouldSetCookieWithAttribute('connect.sid', 'Expires'))
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'HttpOnly'))
          .expect(shouldSetCookieWithAttributeAndValue('connect.sid', 'Path', '/admin'))
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Secure'))
          .expect(200, done)
        })

        it('should preserve cookies set before writeHead is called', function(done){
          var server = createServer(null, function (req, res) {
            var cookie = new Cookie()
            res.setHeader('Set-Cookie', cookie.serialize('previous', 'cookieValue'))
            res.end()
          })

          request(server)
          .get('/')
          .expect(shouldSetCookieToValue('previous', 'cookieValue'))
          .expect(200, done)
        })
      })

      describe('.originalMaxAge', function () {
        it('should equal original maxAge', function (done) {
          var server = createServer({ cookie: { maxAge: 2000 } }, function (req, res) {
            res.end(JSON.stringify(req.session.cookie.originalMaxAge))
          })

          request(server)
            .get('/')
            .expect(200, '2000', done)
        })

        it('should equal original maxAge for all requests', function (done) {
          var server = createServer({ cookie: { maxAge: 2000 } }, function (req, res) {
            res.end(JSON.stringify(req.session.cookie.originalMaxAge))
          })

          request(server)
            .get('/')
            .expect(200, '2000', function (err, res) {
              if (err) return done(err)
              setTimeout(function () {
                request(server)
                  .get('/')
                  .set('Cookie', cookie(res))
                  .expect(200, '2000', done)
              }, 100)
            })
        })

        it('should equal original maxAge for all requests', function (done) {
          var store = new SmartStore()
          var server = createServer({ cookie: { maxAge: 2000 }, store: store }, function (req, res) {
            res.end(JSON.stringify(req.session.cookie.originalMaxAge))
          })

          request(server)
            .get('/')
            .expect(200, '2000', function (err, res) {
              if (err) return done(err)
              setTimeout(function () {
                request(server)
                  .get('/')
                  .set('Cookie', cookie(res))
                  .expect(200, '2000', done)
              }, 100)
            })
        })
      })

      describe('.secure', function(){
        var app

        before(function () {
          app = createRequestListener({ secret: 'keyboard cat', cookie: { secure: true } })
        })

        it('should set cookie when secure', function (done) {
          var cert = fs.readFileSync(path.join(__dirname + '/../fixtures/server.crt'), 'ascii')
          var server = https.createServer({
            key: fs.readFileSync(path.join(__dirname + '/../fixtures/server.key'), 'ascii'),
            cert: cert
          })

          server.on('request', app)

          var agent = new https.Agent({ca: cert})
          var createConnection = agent.createConnection

          agent.createConnection = function (options) {
            options.servername = 'express-session.local'
            return createConnection.call(this, options)
          }

          var req = request(server).get('/')
          req.agent(agent)
          req.expect(shouldSetCookie('connect.sid'))
          req.expect(200, done)
        })

        it('should not set-cookie when insecure', function(done){
          var server = http.createServer(app)

          request(server)
          .get('/')
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, done)
        })
      })

      describe('.maxAge', function () {
        before(function (done) {
          var ctx = this

          ctx.cookie = ''
          ctx.server = createServer({ cookie: { maxAge: 2000 } }, function (req, res) {
            switch (++req.session.count) {
              case 1:
                break
              case 2:
                req.session.cookie.maxAge = 5000
                break
              case 3:
                req.session.cookie.maxAge = 3000000000
                break
              default:
                req.session.count = 0
                break
            }
            res.end(req.session.count.toString())
          })

          request(ctx.server)
          .get('/')
          .end(function (err, res) {
            ctx.cookie = res && cookie(res)
            done(err)
          })
        })

        it('should set cookie expires relative to maxAge', function (done) {
          request(this.server)
          .get('/')
          .set('Cookie', this.cookie)
          .expect(shouldSetCookieToExpireIn('connect.sid', 2000))
          .expect(200, '1', done)
        })

        it('should modify cookie expires when changed', function (done) {
          request(this.server)
          .get('/')
          .set('Cookie', this.cookie)
          .expect(shouldSetCookieToExpireIn('connect.sid', 5000))
          .expect(200, '2', done)
        })

        it('should modify cookie expires when changed to large value', function (done) {
          request(this.server)
          .get('/')
          .set('Cookie', this.cookie)
          .expect(shouldSetCookieToExpireIn('connect.sid', 3000000000))
          .expect(200, '3', done)
        })
      })

      describe('.expires', function(){
        describe('when given a Date', function(){
          it('should set absolute', function(done){
            var server = createServer(null, function (req, res) {
              req.session.cookie.expires = new Date(0)
              res.end()
            })

            request(server)
            .get('/')
            .expect(shouldSetCookieWithAttributeAndValue('connect.sid', 'Expires', 'Thu, 01 Jan 1970 00:00:00 GMT'))
            .expect(200, done)
          })
        })

        describe('when null', function(){
          it('should be a browser-session cookie', function(done){
            var server = createServer(null, function (req, res) {
              req.session.cookie.expires = null
              res.end()
            })

            request(server)
            .get('/')
            .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Expires'))
            .expect(200, done)
          })

          it('should not reset cookie', function (done) {
            var server = createServer(null, function (req, res) {
              req.session.cookie.expires = null;
              res.end();
            });

            request(server)
            .get('/')
            .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Expires'))
            .expect(200, function (err, res) {
              if (err) return done(err);
              request(server)
              .get('/')
              .set('Cookie', cookie(res))
              .expect(shouldNotHaveHeader('Set-Cookie'))
              .expect(200, done)
            });
          })

          it('should not reset cookie when modified', function (done) {
            var server = createServer(null, function (req, res) {
              req.session.cookie.expires = null;
              req.session.hit = (req.session.hit || 0) + 1;
              res.end();
            });

            request(server)
            .get('/')
            .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Expires'))
            .expect(200, function (err, res) {
              if (err) return done(err);
              request(server)
              .get('/')
              .set('Cookie', cookie(res))
              .expect(shouldNotHaveHeader('Set-Cookie'))
              .expect(200, done)
            });
          })
        })
      })
    })
  })

  describe('synchronous store', function(){
    it('should respond correctly on save', function(done){
      var store = new SyncStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        res.end('hits: ' + req.session.count)
      })

      request(server)
      .get('/')
      .expect(200, 'hits: 1', done)
    })

    it('should respond correctly on destroy', function(done){
      var store = new SyncStore()
      var server = createServer({ store: store, unset: 'destroy' }, function (req, res) {
        req.session.count = req.session.count || 0
        var count = ++req.session.count
        if (req.session.count > 1) {
          req.session = null
          res.write('destroyed\n')
        }
        res.end('hits: ' + count)
      })

      request(server)
      .get('/')
      .expect(200, 'hits: 1', function (err, res) {
        if (err) return done(err)
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, 'destroyed\nhits: 2', done)
      })
    })
  })

})

