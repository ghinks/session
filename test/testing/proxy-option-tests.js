const {
  createServer,
  shouldNotHaveHeader,
  shouldSetCookie,
} = require('../support/testUtils')

var request = require('supertest')

describe('proxy option', function(){
  describe('when enabled', function(){
    var server
    before(function () {
      server = createServer({ proxy: true, cookie: { secure: true, maxAge: 5 }})
    })

    it('should trust X-Forwarded-Proto when string', function(done){
      request(server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
    })

    it('should trust X-Forwarded-Proto when comma-separated list', function(done){
      request(server)
        .get('/')
        .set('X-Forwarded-Proto', 'https,http')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
    })

    it('should work when no header', function(done){
      request(server)
        .get('/')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
    })
  })

  describe('when disabled', function(){
    before(function () {
      function setup (req) {
        req.secure = req.headers['x-secure']
          ? JSON.parse(req.headers['x-secure'])
          : undefined
      }

      function respond (req, res) {
        res.end(String(req.secure))
      }

      this.server = createServer(setup, { proxy: false, cookie: { secure: true }}, respond)
    })

    it('should not trust X-Forwarded-Proto', function(done){
      request(this.server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
    })

    it('should ignore req.secure', function (done) {
      request(this.server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Secure', 'true')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, 'true', done)
    })
  })

  describe('when unspecified', function(){
    before(function () {
      function setup (req) {
        req.secure = req.headers['x-secure']
          ? JSON.parse(req.headers['x-secure'])
          : undefined
      }

      function respond (req, res) {
        res.end(String(req.secure))
      }

      this.server = createServer(setup, { cookie: { secure: true }}, respond)
    })

    it('should not trust X-Forwarded-Proto', function(done){
      request(this.server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
    })

    it('should use req.secure', function (done) {
      request(this.server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Secure', 'true')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'true', done)
    })
  })
})

