const {
  createServer,
  shouldSetCookie,
} = require('../../support/testUtils')

var request = require('supertest')
describe('cookie name or key', function() {
  describe('name option', function () {
    it('should default to "connect.sid"', function (done) {
      request(createServer())
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
    })

    it('should set the cookie name', function (done) {
      request(createServer({ name: 'session_id' }))
        .get('/')
        .expect(shouldSetCookie('session_id'))
        .expect(200, done)
    })
  })
  describe('key option', function(){
    it('should default to "connect.sid"', function(done){
      request(createServer())
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
    })

    it('should allow overriding', function(done){
      request(createServer({ key: 'session_id' }))
        .get('/')
        .expect(shouldSetCookie('session_id'))
        .expect(200, done)
    })
  })

})

