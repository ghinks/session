const {
  cookie,
  createSession,
  sid
} = require('../support/testUtils')

var cookieParser = require('cookie-parser')
var express = require('express')
var request = require('supertest')

describe('cookieParser()', function () {
  it('should read from req.cookies', function(done){
    var app = express()
      .use(cookieParser())
      .use(function(req, res, next){ req.headers.cookie = 'foo=bar'; next() })
      .use(createSession())
      .use(function(req, res, next){
        req.session.count = req.session.count || 0
        req.session.count++
        res.end(req.session.count.toString())
      })

    request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        console.log(res.headers);
        if (err) return done(err)
        request(app)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, '2', function(err, res) {
            console.log(res.headers);
            done();
          })
      })
  })

  it('should reject unsigned from req.cookies', function(done){
    var app = express()
      .use(cookieParser())
      .use(function(req, res, next){ req.headers.cookie = 'foo=bar'; next() })
      .use(createSession({ key: 'sessid' }))
      .use(function(req, res, next){
        req.session.count = req.session.count || 0
        req.session.count++
        res.end(req.session.count.toString())
      })

    request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        request(app)
          .get('/')
          .set('Cookie', 'sessid=' + sid(res))
          .expect(200, '1', done)
      })
  })

  it('should reject invalid signature from req.cookies', function(done){
    var app = express()
      .use(cookieParser())
      .use(function(req, res, next){ req.headers.cookie = 'foo=bar'; next() })
      .use(createSession({ key: 'sessid' }))
      .use(function(req, res, next){
        req.session.count = req.session.count || 0
        req.session.count++
        res.end(req.session.count.toString())
      })

    request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        var val = cookie(res).replace(/...\./, '.')
        request(app)
          .get('/')
          .set('Cookie', val)
          .expect(200, '1', done)
      })
  })

  it('should read from req.signedCookies', function(done){
    var app = express()
      .use(cookieParser('keyboard cat'))
      .use(function(req, res, next){ delete req.headers.cookie; next() })
      .use(createSession())
      .use(function(req, res, next){
        req.session.count = req.session.count || 0
        req.session.count++
        res.end(req.session.count.toString())
      })

    request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        request(app)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, '2', done)
      })
  })
})
