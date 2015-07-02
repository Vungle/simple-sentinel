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
        var s = new RedisSentinel([], {outageRetryTimeout: -1}); // jshint ignore:line
      }).toThrow(/empty/);
    });

    it("will allow overrides to options", function () {
      var conf = {outageRetryTimeout: -1};
      var s = new RedisSentinel([{host:"127.0.0.1", port: 6323}]);
      var default_val = s.options.outageRetryTimeout;
      s = new RedisSentinel([{host:"127.0.0.1", port: 6323}], conf);

      expect(s.options.outageRetryTimeout)
        .toBe(-1)
        .toNotBe(default_val);
    });

    it("will allow a client redis lib to be injected", function () {
      var client_redis = { createClient: function () { return "TEST PASS"; }};
      RedisSentinel_lib.setClientRedis(client_redis);
      var s = new RedisSentinel([{host:"127.0.0.1", port: 6323}]);
      expect(s.options.createClient()).toBe("TEST PASS");
    });

    it("will dedupe the list of sentinels", function () {
      var s = new RedisSentinel([
        { host:"127.0.0.1", port: 26379 },
        { host:"127.0.1.2", port: 6323 },
        { host:"127.0.0.1" }
      ]);

      function _equal(a, b) { return a.host === b.host && a.port === b.port; }

      expect(s.sentinels.length).toBe(2);
      expect(s.sentinels)
        .toContain({ host:"127.0.0.1", port: 26379 }, _equal)
        .toContain({ host:"127.0.1.2", port: 6323 }, _equal);
    });

    it("works as both a constructor and a function call", function () {
      var s = new RedisSentinel([{host:"127.0.0.1", port: 6323}], {outageRetryTimeout: -1});
      expect(s).toBeA(RedisSentinel);
      s = RedisSentinel([{host:"127.0.0.1", port: 6323}], {outageRetryTimeout: -1});
      expect(s).toBeA(RedisSentinel);
    });
  });

  describe("when connecting", function () {

    var DEBUG_LOGGING = false;

    var mocks = [];
    var sentinel;

    // Be sure to have plenty of clean-up:
    beforeEach(function () {
      mocks = [new MockSentinel(), new MockSentinel(), new MockSentinel()];
      sentinel = null;
    });
    afterEach (function () {
      mocks.forEach(function (p) { p.kill(); });
      if (sentinel) { sentinel.kill(); }
    });

    // Used for starting the first n mock Sentinels:
    function startNMocks(num, cb) {
      async.map(
        mocks.slice(0, num),
        function (mock, done) {
          mock.start(done);
        },
        cb
      );
    }

    // A createClient that only encodes the info thrown at it:
    function testCreateClient(port, host, config) {
      return host + ":" + port + " " + JSON.stringify(config);
    }

    it("can connect to a sentinel and pull a configuration", function (done) {
      mocks[0]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      startNMocks(1, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient,
          debugLogging: DEBUG_LOGGING
        };

        sentinel = new RedisSentinel([{host:"127.0.0.1", port: ports[0]}], s_conf);
        sentinel.on('change', function (name, repl) {
          expect(name).toBe("main");
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");
          done();
        });
      });
    });

    it("will dodge bad connections", function (done) {
      this.timeout(2000);

      mocks[1]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      startNMocks(2, function (err, ports) {
        if (err) { return done(err); }

        // Kill the first server fast, but keep using its port. That way, the connection gets refused:
        mocks[0].kill(function (err) {
          if (err) { return done(err); }

          // Try a connection?
          var s_conf = {
            outageRetryTimeout: -1,
            createClient: testCreateClient,
            randomizeSentinels: false,
            debugLogging: DEBUG_LOGGING,
            timeout: 100
          };

          var s_list = [
            {host:"127.0.0.1", port: ports[0]},
            {host:"127.0.0.1", port: ports[1]}
          ];

          sentinel = new RedisSentinel(s_list, s_conf);
          sentinel.on('change', function (name, repl) {
            expect(name).toBe("main");
            expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
            expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");
            done();
          });
        });
      });
    });

    it("will dodge timeouts", function (done) {
      this.timeout(1000);

      mocks[1]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      startNMocks(2, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient,
          randomizeSentinels: false,
          debugLogging: DEBUG_LOGGING,
          commandTimeout: 250,
          timeout: 100
        };

        // We use MockSentinel 0 because it'll timeout on the INFO command:

        var s_list = [
          {host:"127.0.0.1", port: ports[0]},
          {host:"127.0.0.1", port: ports[1]}
        ];

        sentinel = new RedisSentinel(s_list, s_conf);
        sentinel.on('change', function (name, repl) {
          expect(name).toBe("main");
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");
          done();
        });
      });
    });

    it("will dodge non-sentinels", function (done) {
      this.timeout(1000);

      mocks[0]
        .setInfo('normal');

      mocks[1]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      startNMocks(2, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient,
          randomizeSentinels: false,
          debugLogging: DEBUG_LOGGING,
          commandTimeout: 250,
          timeout: 100
        };

        var s_list = [
          {host:"127.0.0.1", port: ports[0]},
          {host:"127.0.0.1", port: ports[1]}
        ];

        sentinel = new RedisSentinel(s_list, s_conf);
        sentinel.on('change', function (name, repl) {
          expect(name).toBe("main");
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");
          done();
        });
      });
    });

    it("will retry if so configured", function (done) {
      this.timeout(1000);

      mocks[0]
        .setInfo('normal')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      mocks[1]
        .setInfo('normal');

      startNMocks(2, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          createClient: testCreateClient,
          randomizeSentinels: false,
          debugLogging: DEBUG_LOGGING,
          commandTimeout: 250,
          outageRetryTimeout: 100,
          timeout: 100
        };

        var s_list = [
          { host:"127.0.0.1", port: ports[0]},
          { host:"127.0.0.1", port: ports[1]}
        ];

        // Both mocks are 'normal's, so they'll fail. When the lib tries
        // to connect to the second, however, we'll change the type of the
        // first to 'sentinel' so that on second pass, it'll succeed.

        var did_change_type = false;
        mocks[1].once('connection', function () {
          if (did_change_type) {
            throw new Error("Looped around twice");
          }
          did_change_type = true;
          mocks[0].setInfo('sentinel');
        });

        sentinel = new RedisSentinel(s_list, s_conf);
        sentinel.on('change', function (name, repl) {
          expect(name).toBe("main");
          expect(did_change_type).toBe(true);
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");
          done();
        });
      });
    });

    it("will error if so configured", function (done) {
      this.timeout(1000);

      mocks[0]
        .setInfo('normal')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      mocks[1]
        .setInfo('normal');

      startNMocks(2, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient,
          randomizeSentinels: false,
          debugLogging: DEBUG_LOGGING,
          commandTimeout: 250,
          timeout: 100
        };

        var s_list = [
          { host:"127.0.0.1", port: ports[0]},
          { host:"127.0.0.1", port: ports[1]}
        ];

        sentinel = new RedisSentinel(s_list, s_conf);
        sentinel.on('error', function (err) {
          expect(err).toBeAn(Error);
          expect(err.message).toMatch(/could not connect/i);
          done();
        });
      });
    });

    it("will find a sentinel server when in random mode", function (done) {
      this.timeout(1000);

      mocks[0]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      mocks[1]
        .setInfo('normal');

      mocks[2]
        .setInfo('normal');

      startNMocks(3, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient,
          debugLogging: DEBUG_LOGGING,
          commandTimeout: 250,
          timeout: 100
        };

        var s_list = [
          { host:"127.0.0.1", port: ports[0]},
          { host:"127.0.0.1", port: ports[1]},
          { host:"127.0.0.1", port: ports[2]},
        ];

        sentinel = new RedisSentinel(s_list, s_conf);
        sentinel.on('change', function (name, repl) {
          expect(name).toBe("main");
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");
          done();
        });
      });
    });

    it("will detect and emit when changes happen", function (done) {
      this.timeout(5000);

      mocks[0]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      startNMocks(1, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient,
          debugLogging: DEBUG_LOGGING
        };

        var s_list = [
          { host:"127.0.0.1", port: ports[0]},
        ];

        sentinel = new RedisSentinel(s_list, s_conf);
        sentinel.once('change', function (name, repl) {
          expect(name).toBe("main");
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");

          // Prepare for another change:
          sentinel.once('change', function (name, repl) {
            expect(name).toBe("main");
            expect(repl.connectMaster()).toBe(null);
            expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");
            done();
          });

          setTimeout(function () {
            // Oh no. The "master" just went down. :-O
            mocks[0].addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: true});
            mocks[0].sendEvent("+odown", "master main 127.0.0.1 9001 #quorum 4/3");
          }, 100);
        });
      });
    });

    it("will emit events", function (done) {
      this.timeout(5000);

      mocks[0]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});

      startNMocks(1, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient,
          debugLogging: DEBUG_LOGGING
        };

        var s_list = [
          { host:"127.0.0.1", port: ports[0]},
        ];

        var EV_NAME = "+slave";
        var EV_MSG  = "slave 127.0.0.1:9002 127.0.0.1 9002 @ main 127.0.0.1 9001";

        sentinel = new RedisSentinel(s_list, s_conf);
        sentinel.once('change', function (name, repl) {
          expect(name).toBe("main");
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");

          setTimeout(function () {
            // Oh boy. An interesting event!
            mocks[0].addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: true});
            mocks[0].sendEvent(EV_NAME, EV_MSG);
          }, 100);
        });
        sentinel.once('event', function (name, msg) {
          expect(name).toBe(EV_NAME);
          expect(msg).toBe(EV_MSG);
          done();
        });
      });
    });

    it("will reconnect on errors", function (done) {
      this.timeout(1500);

      mocks[0]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.0.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.1.1", port: 6379, isDown: false});
      mocks[1]
        .setInfo('sentinel')
        .addMaster("main", {ip: "10.0.1.1", port: 6379, isDown: false})
        .addSlave ("main", {ip: "10.0.0.1", port: 6379, isDown: false});

      startNMocks(2, function (err, ports) {
        if (err) { return done(err); }

        // Try a connection?
        var s_conf = {
          outageRetryTimeout: -1,
          createClient: testCreateClient,
          debugLogging: DEBUG_LOGGING,
          randomizeSentinels: false,
          commandTimeout: 100
        };

        var s_list = [
          { host:"127.0.0.1", port: ports[0]},
          { host:"127.0.0.1", port: ports[1]},
          { host:"127.0.0.1", port: ports[2]},
        ];

        sentinel = new RedisSentinel(s_list, s_conf);
        sentinel.once('change', function (name, repl) {
          expect(name).toBe("main");
          expect(repl.connectMaster()).toBe("10.0.0.1:6379 {}");
          expect(repl.connectSlave()).toBe("10.0.1.1:6379 {}");

          // Prepare for another change:
          sentinel.once('change', function (name, repl) {
            expect(name).toBe("main");
            expect(repl.connectMaster()).toBe("10.0.1.1:6379 {}");
            expect(repl.connectSlave()).toBe("10.0.0.1:6379 {}");
            done();
          });

          setTimeout(function () {
            // Get the first sentinel to stop responding. Once the event is sent, the
            // lib should reconnect to the second sentinel, which has the correct
            // config to use.
            mocks[0].stopResponding();
            mocks[0].sendEvent("+odown", "master main 127.0.0.1 9001 #quorum 4/3");
          }, 100);
        });
      });
    });
  });
});
