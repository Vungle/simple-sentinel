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

  // For clean up:
  var w = null;
  afterEach(function (done) {
    if (!w || w.finalized) { return done(); }
    w.on('error', function () {
      done();
    });
    w.kill();
  });

  it("emits 'refresh' on startup", function (done) {
    w = new RedisWatcher("localhost", 6379, {
      _testClient: new FakeClient(),
      refreshTimeout: 5000
    });
    w.on('refresh', done);
  });

  it("emits 'refresh' after period of no changes", function (done) {
    w = new RedisWatcher("localhost", 6379, {
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
    w = new RedisWatcher("localhost", 6379, {
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
    w = new RedisWatcher("localhost", 6379, {
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
    w = new RedisWatcher("localhost", 6379, {
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
    w = new RedisWatcher("localhost", 6379, {
      _testClient: fake_client,
      refreshTimeout: 500
    });
    
    w.once('error', function (err) {
      done();
    });

    fake_client.emit('end');
  });

  it("is useless after kill", function () {
    var is_dead = false;
    var fake_client = new FakeClient();
    fake_client.end = function () {
      if (is_dead) { throw new Error("end() called twice"); }
      is_dead = true;
    };
    fake_client.subscribe = function () {
      if (is_dead) { throw new Error("subscribe after death"); }
    };

    w = new RedisWatcher("localhost", 6379, {
      _testClient: fake_client,
      refreshTimeout: 500
    });

    var times_emitted = 0;
    w.on('error', function () {
      if (++times_emitted !== 1) {
        throw new Error("Multiple emits");
      }
    })

    w.kill();

    // Hit the various endpoints, making sure things don't happen:
    w.kill();
    w._handleClientError(new Error());
    w._handleClientHangup();
    w._handleConnectReady();
    w._resetTimer();
    expect(w.timeout).toBe(undefined);

    expect(is_dead).toBe(true);
  });
});
