const {
  cookie,
  createServer,
  shouldSetCookie,
  shouldSetCookieToDifferentSessionId,
  sid
} = require('../support/testUtils')

var request = require('supertest')
var session = require('../../index')

describe('when sid not in store', function () {
  it('should create a new session', function (done) {
    var count = 0
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.session.num = req.session.num || ++count
      res.end('session ' + req.session.num)
    });

    request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        store.clear(function (err) {
          if (err) return done(err)
          request(server)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(200, 'session 2', done)
        })
      })
  })

  it('should have a new sid', function (done) {
    var count = 0
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.session.num = req.session.num || ++count
      res.end('session ' + req.session.num)
    });

    request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        store.clear(function (err) {
          if (err) return done(err)
          request(server)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(shouldSetCookie('connect.sid'))
            .expect(shouldSetCookieToDifferentSessionId(sid(res)))
            .expect(200, 'session 2', done)
        })
      })
  })
})

