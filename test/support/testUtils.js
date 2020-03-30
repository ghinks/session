var http = require('http')
var session = require('../../index')
var assert = require('assert')
var utils = require('./utils')
function cookie(res) {
  var setCookie = res.headers['set-cookie'];
  return (setCookie && setCookie[0]) || undefined;
}

function createServer (options, respond) {
  var fn = respond
  var opts = options
  var server = http.createServer()

  // setup, options, respond
  if (typeof arguments[0] === 'function') {
    opts = arguments[1]
    fn = arguments[2]

    server.on('request', arguments[0])
  }

  return server.on('request', createRequestListener(opts, fn))
}

function createRequestListener(opts, fn) {
  var _session = createSession(opts)
  var respond = fn || end

  return function onRequest(req, res) {
    var server = this

    _session(req, res, function (err) {
      if (err && !res._header) {
        res.statusCode = err.status || 500
        res.end(err.message)
        return
      }

      if (err) {
        server.emit('error', err)
        return
      }

      respond(req, res)
    })
  }
}

function createSession(opts) {
  var options = opts || {}

  if (!('cookie' in options)) {
    options.cookie = { maxAge: 60 * 1000 }
  }

  if (!('secret' in options)) {
    options.secret = 'keyboard cat'
  }

  return session(options)
}

function end(req, res) {
  res.end()
}

function expires (res) {
  var header = cookie(res)
  return header && utils.parseSetCookie(header).expires
}

function mountAt (path) {
  return function (req, res) {
    if (req.url.indexOf(path) === 0) {
      req.originalUrl = req.url
      req.url = req.url.slice(path.length)
    }
  }
}

function shouldNotHaveHeader(header) {
  return function (res) {
    assert.ok(!(header.toLowerCase() in res.headers), 'should not have ' + header + ' header')
  }
}

function shouldNotSetSessionInStore(store) {
  var _set = store.set
  var count = 0

  store.set = function set () {
    count++
    return _set.apply(this, arguments)
  }

  return function () {
    assert.ok(count === 0, 'should not set session in store')
  }
}

function shouldSetCookie (name) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
  }
}

function shouldSetCookieToDifferentSessionId (id) {
  return function (res) {
    assert.notStrictEqual(sid(res), id)
  }
}

function shouldSetCookieToExpireIn (name, delta) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.ok(('expires' in data), 'should set cookie with attribute Expires')
    assert.ok(('date' in res.headers), 'should have a date header')
    assert.strictEqual((Date.parse(data.expires) - Date.parse(res.headers.date)), delta, 'should set cookie ' + name + ' to expire in ' + delta + ' ms')
  }
}

function shouldSetCookieToValue (name, val) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.strictEqual(data.value, val, 'should set cookie ' + name + ' to ' + val)
  }
}

function shouldSetCookieWithAttribute (name, attrib) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.ok((attrib.toLowerCase() in data), 'should set cookie with attribute ' + attrib)
  }
}

function shouldSetCookieWithAttributeAndValue (name, attrib, value) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.ok((attrib.toLowerCase() in data), 'should set cookie with attribute ' + attrib)
    assert.strictEqual(data[attrib.toLowerCase()], value, 'should set cookie with attribute ' + attrib + ' set to ' + value)
  }
}

function shouldSetCookieWithoutAttribute (name, attrib) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.ok(!(attrib.toLowerCase() in data), 'should set cookie without attribute ' + attrib)
  }
}

function shouldSetSessionInStore(store) {
  var _set = store.set
  var count = 0

  store.set = function set () {
    count++
    return _set.apply(this, arguments)
  }

  return function () {
    assert.ok(count === 1, 'should set session in store')
  }
}

function sid (res) {
  var header = cookie(res)
  var data = header && utils.parseSetCookie(header)
  var value = data && unescape(data.value)
  var sid = value && value.substring(2, value.indexOf('.'))
  return sid || undefined
}

module.exports = {
  cookie,
  createServer,
  createRequestListener,
  createSession,
  end,
  expires,
  mountAt,
  shouldNotHaveHeader,
  shouldSetCookie,
  shouldSetCookieToDifferentSessionId,
  shouldNotSetSessionInStore,
  shouldSetCookieToExpireIn,
  shouldSetCookieToValue,
  shouldSetCookieWithAttribute,
  shouldSetCookieWithAttributeAndValue,
  shouldSetCookieWithoutAttribute,
  shouldSetSessionInStore,
  sid
}
