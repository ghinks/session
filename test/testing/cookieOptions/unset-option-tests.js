const {
  cookie,
  createServer,
  shouldNotHaveHeader,
} = require('../../support/testUtils')

var after = require('after')
var assert = require('assert')
var request = require('supertest')
var session = require('../../../index')
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

