var RedisWatcher = require('../src/redisWatcher')
  , EventEmitter = require('events').EventEmitter
  , util = require('../src/util')
  , expect = require('expect');


function FakeClient() {
  this.subscribe = function () {};
  this.end = function () {};
}

util.inherits(FakeClient, EventEmitter);


describe("RedisWatcher", function () {
  this.timeout(200);

  it("emits 'refresh' on startup", function (done) {
    var w = new RedisWatcher("localhost", 6379, {
      _testClient: new FakeClient(),
      refreshTimeout: 5000
    });
    w.on('refresh', done);
  });

  it("emits 'refresh' after period of no changes", function (done) {
    var w = new RedisWatcher("localhost", 6379, {
      _testClient: new FakeClient(),
      refreshTimeout: 75
    });
    
    var count = 0;
    w.on('refresh', function () {
      // 1 init + 75 ms + 150ms
      if (++count === 3) {
        return done();
      }
    });
  });

  it("emits 'refresh' after change", function (done) {
    var fake_client = new FakeClient();
    var w = new RedisWatcher("localhost", 6379, {
      _testClient: fake_client,
      refreshTimeout: 500
    });
    
    fake_client.emit('ready');

    w.once('refresh', function () {
      // init
      w.once('refresh', done);
      // Emit a "change":
      fake_client.emit('message', '+sdown', "oh noes it's down. :'(");
    });
  });

  it("emits 'event' after events", function (done) {
    var fake_client = new FakeClient();
    var w = new RedisWatcher("localhost", 6379, {
      _testClient: fake_client,
      refreshTimeout: 500
    });
    
    fake_client.emit('ready');

    w.once('refresh', function () {
      // Emit a "change":
      w.once('event', function (type, msg) {
        expect(type).toBe("+slave");
        expect(msg).toBe("oh noes it's down. :'(");
        done();
      });

      fake_client.emit('message', '+slave', "oh noes it's down. :'(");
    });
  });

  it("emits 'error' on error", function (done) {
    var fake_client = new FakeClient();
    var w = new RedisWatcher("localhost", 6379, {
      _testClient: fake_client,
      refreshTimeout: 500
    });
    
    w.once('error', function (err) {
      expect(err.message).toBe("LOL HI");
      done();
    });

    fake_client.emit('error', new Error("LOL HI"));
  });
  
  it("emits 'error' on hangup", function (done) {
    var fake_client = new FakeClient();
    var w = new RedisWatcher("localhost", 6379, {
      _testClient: fake_client,
      refreshTimeout: 500
    });
    
    w.once('error', function (err) {
      done();
    });

    fake_client.emit('end');
  });
});
