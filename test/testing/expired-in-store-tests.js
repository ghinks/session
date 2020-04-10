const {
  cookie,
  createServer,
  shouldSetCookie,
  shouldSetCookieToDifferentSessionId,
  sid
} = require('../support/testUtils');

var assert = require('assert')
var request = require('supertest')
var session = require('../../index')
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

