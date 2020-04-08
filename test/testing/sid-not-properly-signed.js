const {
  cookie,
  createServer,
  shouldSetCookie,
  shouldSetCookieToDifferentSessionId,
  sid
} = require('../support/testUtils')

var assert = require('assert')
var request = require('supertest')
var session = require('../../index')

describe('when sid not properly signed', function () {
  it('should generate new session', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store, key: 'sessid' }, function (req, res) {
      var isnew = req.session.active === undefined
      req.session.active = true
      res.end('session ' + (isnew ? 'created' : 'read'))
    })

    request(server)
      .get('/')
      .expect(shouldSetCookie('sessid'))
      .expect(200, 'session created', function (err, res) {
        if (err) return done(err)
        var val = sid(res)
        assert.ok(val)
        request(server)
          .get('/')
          // I MADE A CHANGE BELOW <============================== added s:
          .set('Cookie', 'sessid=s:' + val)
          .expect(shouldSetCookie('sessid'))
          .expect(shouldSetCookieToDifferentSessionId(val))
          .expect(200, 'session created', done)
      })
  })

  it('should not attempt fetch from store', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store, key: 'sessid' }, function (req, res) {
      var isnew = req.session.active === undefined
      req.session.active = true
      res.end('session ' + (isnew ? 'created' : 'read'))
    })

    request(server)
      .get('/')
      .expect(shouldSetCookie('sessid'))
      .expect(200, 'session created', function (err, res) {
        if (err) return done(err)
        var cookieheader = cookie(res)
        var val = cookieheader.replace(/...\./, '.')

        assert.ok(val)
        request(server)
          .get('/')
          .set('Cookie', val)
          .expect(shouldSetCookie('sessid'))
          .expect(200, 'session created', done)
      })
  })
})

