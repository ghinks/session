const {
  createServer,
  mountAt,
  shouldNotHaveHeader,
  shouldSetCookie,
  shouldSetCookieWithAttribute,
  shouldSetCookieWithoutAttribute,
} = require('../support/testUtils')

var request = require('supertest')

describe('cookie option', function () {
  describe('when "path" set to "/foo/bar"', function () {
    before(function () {
      this.server = createServer({ cookie: { path: '/foo/bar' } })
    })

    it('should not set cookie for "/" request', function (done) {
      request(this.server)
        .get('/')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
    })

    it('should not set cookie for "http://foo/bar" request', function (done) {
      request(this.server)
        .get('/')
        .set('host', 'http://foo/bar')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
    })

    it('should set cookie for "/foo/bar" request', function (done) {
      request(this.server)
        .get('/foo/bar/baz')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
    })

    it('should set cookie for "/foo/bar/baz" request', function (done) {
      request(this.server)
        .get('/foo/bar/baz')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
    })

    describe('when mounted at "/foo"', function () {
      before(function () {
        this.server = createServer(mountAt('/foo'), { cookie: { path: '/foo/bar' } })
      })

      it('should set cookie for "/foo/bar" request', function (done) {
        request(this.server)
          .get('/foo/bar')
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, done)
      })

      it('should not set cookie for "/foo/foo/bar" request', function (done) {
        request(this.server)
          .get('/foo/foo/bar')
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, done)
      })
    })
  })

  describe('when "secure" set to "auto"', function () {
    describe('when "proxy" is "true"', function () {
      before(function () {
        this.server = createServer({ proxy: true, cookie: { maxAge: 5, secure: 'auto' }})
      })

      it('should set secure when X-Forwarded-Proto is https', function (done) {
        request(this.server)
          .get('/')
          .set('X-Forwarded-Proto', 'https')
          .expect(shouldSetCookieWithAttribute('connect.sid', 'Secure'))
          .expect(200, done)
      })
    })

    describe('when "proxy" is "false"', function () {
      before(function () {
        this.server = createServer({ proxy: false, cookie: { maxAge: 5, secure: 'auto' }})
      })

      it('should not set secure when X-Forwarded-Proto is https', function (done) {
        request(this.server)
          .get('/')
          .set('X-Forwarded-Proto', 'https')
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Secure'))
          .expect(200, done)
      })
    })

    describe('when "proxy" is undefined', function() {
      before(function () {
        function setup (req) {
          req.secure = JSON.parse(req.headers['x-secure'])
        }

        function respond (req, res) {
          res.end(String(req.secure))
        }

        this.server = createServer(setup, { cookie: { secure: 'auto' } }, respond)
      })

      it('should set secure if req.secure = true', function (done) {
        request(this.server)
          .get('/')
          .set('X-Secure', 'true')
          .expect(shouldSetCookieWithAttribute('connect.sid', 'Secure'))
          .expect(200, 'true', done)
      })

      it('should not set secure if req.secure = false', function (done) {
        request(this.server)
          .get('/')
          .set('X-Secure', 'false')
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Secure'))
          .expect(200, 'false', done)
      })
    })
  })
})

