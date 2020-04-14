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
var MemoryStore = require('../../index').MemoryStore
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
      var store = new MemoryStore()
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
      var store = new MemoryStore()
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
      var store = new MemoryStore()
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
      var store = new MemoryStore()
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
      var store = new MemoryStore()
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

  describe('when session without cookie property in store', function () {
    it('should pass error from inflate', function (done) {
      var count = 0
      var store = new MemoryStore()
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

