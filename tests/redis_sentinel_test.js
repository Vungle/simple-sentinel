var RedisSentinel_lib = require('../src/redisSentinel')
  , RedisSentinel = RedisSentinel_lib.RedisSentinel
  , MockSentinel = require('./util/mockSentinel')
  , async = require('async')
  , expect = require('expect');

describe("RedisSentinel", function () {
  
  describe("when validating a sentinel array", function () {

    var validate = RedisSentinel._validateSentinelList;

    it("fails when array is falsy", function () {
      expect(function () {
        validate(null);
      }).toThrow(/array/i);
    });

    it("fails when array is not an array", function () {
      expect(function () {
        validate("wrong type");
      }).toThrow(/array/i);
    });

    it("fails when array is empty", function () {
      expect(function () {
        validate([]);
      }).toThrow(/empty/i);
    });

    it("fails when item in array is falsy", function () {
      expect(function () {
        validate([{host: "10.0.0.1"}, null]);
      }).toThrow(/#1 .*isn't an object/i);
    });

    it("fails when item in array is not an object", function () {
      expect(function () {
        validate([{host: "10.0.0.1"}, "10.0.0.2"]);
      }).toThrow(/#1 .*isn't an object/i);
    });

    it("fails when item in array omits host", function () {
      expect(function () {
        validate([{host: "10.0.0.1"}, {foo: "bar"}]);
      }).toThrow(/#1 .*host/i);
    });

    it("succeeds when everything is ok", function () {
      expect(function () {
        validate([{host: "10.0.0.1"}, {host: "10.0.0.2", port: 1234}]);
      }).toNotThrow();
    });
  });

  describe("when constructing", function () {

    // At this stage, we're just testing constructing. Suppress the
    // actual connections:
    var saved_connect = null;
    beforeEach(function () {
      saved_connect = RedisSentinel.prototype._connectSentinel;
      RedisSentinel.prototype._connectSentinel = function () {};
    });

    afterEach(function () {
      RedisSentinel.prototype._connectSentinel = saved_connect;
      saved_connect = null;
    });

    it("rejects a bad sentinel list", function () {
      expect(function () {
        var s = new RedisSentinel([], {outageRetryTimeout: -1});
      }).toThrow(/empty/);
    });

    it("will allow overrides to options");
    it("works as both a constructor and a function call", function () {
      var s = new RedisSentinel([{host:"127.0.0.1", port: 6323}], {outageRetryTimeout: -1});
      expect(s).toBeA(RedisSentinel);
      s = RedisSentinel([{host:"127.0.0.1", port: 6323}], {outageRetryTimeout: -1});
      expect(s).toBeA(RedisSentinel);
    });
  });

  describe("when connecting", function () {
    
    var mocks = [];
    var sentinel;

    // Be sure to have plenty of clean-up:
    beforeEach(function () {
      mocks = [new MockSentinel(), new MockSentinel, new MockSentinel()];
      sentinel = null;
    });
    afterEach (function () {
      mocks.forEach(function (p) { p.kill(); });
      sentinel && sentinel.kill();
    });

    // Used for starting the first n mock Sentinels:
    function startNMocks(num, cb) {
      async.map(
        mocks.slice(0, num),
        function (mock, done) {
          mock.start(done);
        },
        cb
      )
    }

    // A createClient that only encodes the info thrown at it:
    function testCreateClient(port, host, config) {
      return host + ":" + port + " " + JSON.stringify(config);
    }

    it("can connect to a sentinel and pull a configuration", function (done) {
      mocks[0]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      startNMocks(1, function (err, port) {
        if (err) { return done(err); }
        
        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient
        };

        sentinel = new RedisSentinel([{host:"127.0.0.1", port: port}], s_conf);
        sentinel.on('change', function (name, repl) {
          expect(name).toBe("main");
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");
          done();
        });
      });
    });

    it("will dodge bad connections");
    it("will dodge timeouts");
    it("will dodge non-sentinels");
    it("will retry if so configured");
    it("will error if so configured");
    it("will find a sentinel server");
    it("will detect and not emit when no change");
    it("will detect and emit on changes");
    it("will emit events");
    it("will reconnect on errors");
  });
});
