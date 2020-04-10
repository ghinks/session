const {
  cookie,
  createServer,
  shouldNotSetSessionInStore,
  shouldSetSessionInStore,
} = require('../../support/testUtils')

var after = require('after')
var assert = require('assert')
var request = require('supertest')
var session = require('../../../index')

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

