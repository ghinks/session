const {
  createServer,
  shouldNotHaveHeader,
  shouldSetCookie,
  shouldNotSetSessionInStore,
  shouldSetSessionInStore,
} = require('../support/testUtils')

var after = require('after')
var assert = require('assert')
var request = require('supertest')
var MemoryStore = require('../../index').MemoryStore
var min = 60 * 1000;

describe('saveUninitialized option', function(){
  it('should default to true', function(done){
    var store = new MemoryStore()
    var server = createServer({ store: store })

    request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
  });

  it('should force save of uninitialized session', function(done){
    var store = new MemoryStore()
    var server = createServer({ store: store, saveUninitialized: true })

    request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
  });

  it('should prevent save of uninitialized session', function(done){
    var store = new MemoryStore()
    var server = createServer({ store: store, saveUninitialized: false })

    request(server)
      .get('/')
      .expect(shouldNotSetSessionInStore(store))
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, done)
  });

  it('should still save modified session', function(done){
    var store = new MemoryStore()
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
    var store = new MemoryStore()
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
    var store = new MemoryStore()
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

