const {
  createServer,
  shouldSetCookie,
  shouldSetCookieToValue,
} = require('../support/testUtils')

var assert = require('assert')
var request = require('supertest')
var session = require('../../index')

describe('genid option', function(){
  it('should reject non-function values', function(){
    assert.throws(session.bind(null, { genid: 'bogus!' }), /genid.*must/)
  });

  it('should provide default generator', function(done){
    request(createServer())
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done)
  });

  it('should allow custom function', function(done){
    function genid() { return 'apple' }

    request(createServer({ genid: genid }))
      .get('/')
      .expect(shouldSetCookieToValue('connect.sid', 's%3Aapple.D8Y%2BpkTAmeR0PobOhY4G97PRW%2Bj7bUnP%2F5m6%2FOn1MCU'))
      .expect(200, done)
  });

  it('should encode unsafe chars', function(done){
    function genid() { return '%' }

    request(createServer({ genid: genid }))
      .get('/')
      .expect(shouldSetCookieToValue('connect.sid', 's%3A%25.kzQ6x52kKVdF35Qh62AWk4ZekS28K5XYCXKa%2FOTZ01g'))
      .expect(200, done)
  });

  it('should provide req argument', function(done){
    function genid(req) { return req.url }

    request(createServer({ genid: genid }))
      .get('/foo')
      .expect(shouldSetCookieToValue('connect.sid', 's%3A%2Ffoo.paEKBtAHbV5s1IB8B2zPnzAgYmmnRPIqObW4VRYj%2FMQ'))
      .expect(200, done)
  });
});

