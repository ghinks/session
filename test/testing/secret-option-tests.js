const {
  cookie,
  createServer,
  shouldSetCookie,
} = require('../support/testUtils')

var assert = require('assert')
var request = require('supertest')
var session = require('../../index')
describe('secret option', function () {
  it('should reject empty arrays', function () {
    assert.throws(createServer.bind(null, { secret: [] }), /secret option array/);
  })

  describe('when an array', function () {
    it('should sign cookies', function (done) {
      var server = createServer({ secret: ['keyboard cat', 'nyan cat'] }, function (req, res) {
        req.session.user = 'bob';
        res.end(req.session.user);
      });

      request(server)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'bob', done);
    })

    it('should sign cookies with first element', function (done) {
      var store = new session.MemoryStore();

      var server1 = createServer({ secret: ['keyboard cat', 'nyan cat'], store: store }, function (req, res) {
        req.session.user = 'bob';
        res.end(req.session.user);
      });

      var server2 = createServer({ secret: 'nyan cat', store: store }, function (req, res) {
        res.end(String(req.session.user));
      });

      request(server1)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'bob', function (err, res) {
          if (err) return done(err);
          request(server2)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(200, 'undefined', done);
        });
    });

    it('should read cookies using all elements', function (done) {
      var store = new session.MemoryStore();

      var server1 = createServer({ secret: 'nyan cat', store: store }, function (req, res) {
        req.session.user = 'bob';
        res.end(req.session.user);
      });

      var server2 = createServer({ secret: ['keyboard cat', 'nyan cat'], store: store }, function (req, res) {
        res.end(String(req.session.user));
      });

      request(server1)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'bob', function (err, res) {
          if (err) return done(err);
          request(server2)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(200, 'bob', done);
        });
    });
  })
})

