const {
  cookie,
  createServer,
  createRequestListener,
  shouldNotHaveHeader,
  shouldSetCookie,
  shouldSetCookieToDifferentSessionId,
  shouldSetCookieToExpireIn,
  shouldSetCookieToValue,
  shouldSetCookieWithAttribute,
  shouldSetCookieWithAttributeAndValue,
  shouldSetCookieWithoutAttribute,
  shouldSetSessionInStore,
  sid
} = require('../support/testUtils')

var assert = require('assert')
var fs = require('fs')
var http = require('http')
var https = require('https')
var request = require('supertest')
var SmartStore = require('../support/smart-store')
var path = require('path')
var MemoryStore = require('../../index').MemoryStore
var Cookie = require('../../session/cookie')

var min = 60 * 1000;

describe('req.session', function(){
  it('should persist', function(done){
    var store = new MemoryStore()
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
    var store = new MemoryStore()
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
    var store = new MemoryStore()
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
          const cookieValue = cookie(res)
          request(server)
            .get('/')
            .set('Cookie',cookieValue)
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
      var store = new MemoryStore()
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
      var store = new MemoryStore()
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
      var store = new MemoryStore()
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
      var store = new MemoryStore()
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
      var store = new MemoryStore()
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

