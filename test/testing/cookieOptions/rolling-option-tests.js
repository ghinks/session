const {
  cookie,
  createServer,
  shouldNotHaveHeader,
  shouldSetCookie,
  shouldNotSetSessionInStore,
  shouldSetSessionInStore,
} = require('../../support/testUtils')

var request = require('supertest')
var session = require('../../../index')

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

