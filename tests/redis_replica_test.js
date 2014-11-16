var RedisReplica = require('../src/redisReplica')
  , expect = require('expect');


describe('RedisReplica', function () {
  
  describe("when checking isDown", function () {
    
    var isDown = RedisReplica._isDown;

    it("handles null values", function () {
      expect(isDown("slave", null)).toBe(true);
      expect(isDown("slave", undefined)).toBe(true);
      expect(isDown("master", null)).toBe(true);
      expect(isDown("master", undefined)).toBe(true);
    });

    it("handles config without flags", function () {
      expect(isDown("slave", {})).toBe(false);
      expect(isDown("master", {})).toBe(false);
    });

    it("detects an up slave", function () {
      expect(isDown("slave", {flags: ["slave"]})).toBe(false);
    });

    it("detects a down slave", function () {
      expect(isDown("slave", {flags: ["slave", "s_down"]})).toBe(true);
    });

    it("detects an up master", function () {
      expect(isDown("master", {flags: ["master"]})).toBe(false);
      expect(isDown("master", {flags: ["master", "s_down"]})).toBe(false);
    });

    it("detects a down master", function () {
      expect(isDown("master", {flags: ["slave", "o_down"]})).toBe(true);
    });
  });

  describe("when loading a master config", function () {
    it("detects no change from null to null", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadMasterConfig(null);
      expect(res).toBe(false);
    });

    it("detects change from null to config", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
    });

    it("detects change from config to null", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
      res = repl._loadMasterConfig(null);
      expect(res).toBe(true);
    });

    it("rejects loading a config from the wrong name", function () {
      var repl = new RedisReplica("fake", null, {});
      
      expect(function () {
        repl._loadMasterConfig({name: "totally_real", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      }).toThrow(/wrong replica/i);
    });

    it("detects no change from config to config", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
      res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(false);
    });

    it("detects changes in ip", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
      res = repl._loadMasterConfig({name: "fake", ip: "10.123.45.67", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
    });

    it("detects changes in port", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
      res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 16379, flags: ["master"]});
      expect(res).toBe(true);
    });

    it("detects changes in up/down", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
      res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master", "o_down"]});
      expect(res).toBe(true);
      res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
    });

    it("detects s_down's for master", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(true);
      res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master", "s_down"]});
      expect(res).toBe(false);
      res = repl._loadMasterConfig({name: "fake", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      expect(res).toBe(false);
    });
  });

  describe("when loading slave configs", function () {
    it("detects no change from null to null", function () {
      var repl = new RedisReplica("fake", null, {});
      var res = repl._loadSlaveConfigs(null);
      expect(res).toBe(false);
    });

    it("detects change from null to list", function () {
      var repl = new RedisReplica("fake", null, {});
      var new_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave"]
        }
      ];
      var res = repl._loadSlaveConfigs(new_conf);
      expect(res).toBe(true);
    });

    it("detects change from list to null", function () {
      var repl = new RedisReplica("fake", null, {});
      var new_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave"]
        }
      ];
      var res = repl._loadSlaveConfigs(new_conf);
      expect(res).toBe(true);
      res = repl._loadSlaveConfigs(null);
      expect(res).toBe(true);
    });

    it("detects no change from list to same list", function () {
      var repl = new RedisReplica("fake", null, {});
      var new_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave"]
        }
      ];
      var res = repl._loadSlaveConfigs(new_conf);
      expect(res).toBe(true);
      res = repl._loadSlaveConfigs(new_conf);
      expect(res).toBe(false);
    });

    it("detects change when lists are different length", function () {
      var repl = new RedisReplica("fake", null, {});
      var old_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave"]
        },
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6380,
          flags: ["slave"]
        }
      ];
      var new_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave"]
        }
      ];
      var res = repl._loadSlaveConfigs(old_conf);
      expect(res).toBe(true);
      res = repl._loadSlaveConfigs(new_conf);
      expect(res).toBe(true);
    });

    it("detects change when new ip is introduced", function () {
      var repl = new RedisReplica("fake", null, {});
      var old_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave"]
        }
      ];
      var new_conf = [
        {
          name: "fake",
          ip: "127.0.0.2",
          port: 6379,
          flags: ["slave"]
        }
      ];
      var res = repl._loadSlaveConfigs(old_conf);
      expect(res).toBe(true);
      res = repl._loadSlaveConfigs(new_conf);
      expect(res).toBe(true);
    });

    it("detects change when new port is introduced", function () {
      var repl = new RedisReplica("fake", null, {});
      var old_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave"]
        }
      ];
      var new_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6380,
          flags: ["slave"]
        }
      ];
      var res = repl._loadSlaveConfigs(old_conf);
      expect(res).toBe(true);
      res = repl._loadSlaveConfigs(new_conf);
      expect(res).toBe(true);
    });

    it("detects change when server changes up/down state", function () {
      var repl = new RedisReplica("fake", null, {});
      var old_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave", "s_down"]
        }
      ];
      var new_conf = [
        {
          name: "fake",
          ip: "127.0.0.1",
          port: 6379,
          flags: ["slave"]
        }
      ];
      var res = repl._loadSlaveConfigs(old_conf);
      expect(res).toBe(true);
      res = repl._loadSlaveConfigs(new_conf);
      expect(res).toBe(true);
      res = repl._loadSlaveConfigs(old_conf);
      expect(res).toBe(true);
    });
  });
  
  describe("when creating user clients", function () {

    var _conf = {"lol": 123};

    function makeCreateClient() {
      return function _createClient(port, host, config) {
        expect(config.lol).toBe(123);
        return host + ":" + port;
      };
    }

    describe("for a master", function () {
      it("returns null when no config", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        var res = repl.connectMaster();
        expect(res).toBe(null);
      });

      it("returns null when master is down", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        repl._loadMasterConfig({name: "lol", ip: "10.0.0.1", port: 6379, flags: ["master", "o_down"]});
        var res = repl.connectMaster();
        expect(res).toBe(null);
      });

      it("returns a client when master is up", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        repl._loadMasterConfig({name: "lol", ip: "10.0.0.1", port: 6379, flags: ["master"]});
        var res = repl.connectMaster();
        expect(res).toBe("10.0.0.1:6379");
      });
    });

    describe("for a random slave", function () {
      
      // Random tests suck, so I just captured Math.random() values in here, and
      // we return them, in order, looping, so that we get consistent results:
      var rand_values = [
        0.715845766, 0.051367745, 0.675104293, 0.448307905, 0.713363221, 0.873357441,
        0.792706331, 0.835047490, 0.200214375, 0.704713299, 0.547501155, 0.966028834,
        0.392288157, 0.977402867, 0.584800564, 0.929895702, 0.217492668, 0.359781738,
        0.710340757, 0.920402542, 0.848172454, 0.094015050, 0.442929151, 0.499152195,
        0.062294991, 0.228426645, 0.010479365, 0.779217425, 0.671819255, 0.658546096,
        0.097430948, 0.264806017, 0.416617402, 0.202993543, 0.473419679, 0.107525041,
        0.236953518, 0.188559022, 0.795392269, 0.577662272, 0.738166236, 0.998207827,
        0.648416910, 0.910020646, 0.370073152, 0.900422364, 0.981973963, 0.513069100,
        0.901448062, 0.912173099, 0.615404443, 0.953569356, 0.124154245, 0.079709604,
        0.843693365, 0.233913375, 0.116981740, 0.971280579, 0.420873296, 0.425035121,
        0.878392498, 0.142440465, 0.020015148, 0.299002940, 0.472552949, 0.613979072,
        0.179202477, 0.702628072, 0.551905613, 0.197057615, 0.909234748, 0.581873472,
        0.307028834, 0.778485547, 0.604170046, 0.050436106, 0.472222610, 0.619664918,
        0.319781737, 0.955484421, 0.755287120, 0.390939193, 0.009491783, 0.770722393,
        0.669567544, 0.087312787, 0.128874362, 0.064460350, 0.160529132, 0.175202386,
        0.151726768, 0.045888786, 0.395941542, 0.335599424, 0.963686724, 0.464009853,
        0.006510694, 0.071882985, 0.053042541, 0.002643924
      ];

      // Swap out Math.random before tests:
      var saved_random = null;
      beforeEach(function () {
        saved_random = Math.random;

        var rand_idx = 0;
        Math.random = function () {
          rand_idx = (rand_idx + 1) % rand_values.length;
          return rand_values[rand_idx];
        };
      });

      // Repair it after each test:
      afterEach(function () {
        Math.random = saved_random;
        saved_random = null;
      });

      it("returns null when no slaves", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        var res = repl.connectSlave();
        expect(res).toBe(null);
      });

      it("returns null when all slaves are down", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        repl._loadSlaveConfigs([
          {name: "lol", ip: "10.0.0.1", port: 6379, flags: ["slave", "s_down"]},
          {name: "lol", ip: "10.0.0.1", port: 6380, flags: ["slave", "s_down"]},
          {name: "lol", ip: "10.0.0.1", port: 6381, flags: ["slave", "s_down"]}
        ]);
        var res = repl.connectSlave();
        expect(res).toBe(null);
      });

      it("returns a random slave when at least one is up", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        repl._loadSlaveConfigs([
          {name: "lol", ip: "10.0.0.1", port: 6379, flags: ["slave", "s_down"]},
          {name: "lol", ip: "10.0.0.1", port: 6380, flags: ["slave"]},
          {name: "lol", ip: "10.0.0.1", port: 6381, flags: ["slave"]}
        ]);

        var counts = {"10.0.0.1:6380": 0, "10.0.0.1:6381": 0};
        for (var i=0; i<100; i++) {
          var res = repl.connectSlave();
          if (!counts.hasOwnProperty(res)) {
            throw new Error("Unexpected result: " + String(res));
          }
          counts[res]++;
        }
        expect(counts["10.0.0.1:6380"]).toBeGreaterThan(40);
        expect(counts["10.0.0.1:6381"]).toBeGreaterThan(40);
      });
    });

    describe("for all slaves", function () {
      it("returns an empty array when no slaves", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        var res = repl.connectAllSlaves();
        expect(res).toBeAn(Array);
        expect(res.length).toBe(0);
      });

      it("returns an empty array when all slaves are down", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        repl._loadSlaveConfigs([
          {name: "lol", ip: "10.0.0.1", port: 6379, flags: ["slave", "s_down"]},
          {name: "lol", ip: "10.0.0.1", port: 6380, flags: ["slave", "s_down"]},
          {name: "lol", ip: "10.0.0.1", port: 6381, flags: ["slave", "s_down"]}
        ]);
        var res = repl.connectAllSlaves();
        expect(res).toBeAn(Array);
        expect(res.length).toBe(0);
      });

      it("returns all live slaves in an array", function () {
        var repl = new RedisReplica("lol", makeCreateClient(), _conf);
        repl._loadSlaveConfigs([
          {name: "lol", ip: "10.0.0.1", port: 6379, flags: ["slave"]},
          {name: "lol", ip: "10.0.0.1", port: 6380, flags: ["slave", "s_down"]},
          {name: "lol", ip: "10.0.0.1", port: 6381, flags: ["slave"]}
        ]);
        var res = repl.connectAllSlaves();
        expect(res).toBeAn(Array);
        expect(res.length).toBe(2);
        expect(res).toContain("10.0.0.1:6379");
        expect(res).toContain("10.0.0.1:6381");
      });
    });
  });

  describe("when shown as a string", function () {
    it("works when empty", function () {
      var repl = new RedisReplica("lol", null, {});
      var str = repl.toString();
      expect(str).toMatch(/RedisReplica/i);
    });

    it("works with a master", function () {
      var repl = new RedisReplica("lol", null, {});
      
      repl._loadMasterConfig({name: "lol", ip: "127.0.0.1", port: 6379, flags: ["master"]});
      var str = repl.toString();
      expect(str).toMatch(/RedisReplica/i);
      expect(str).toMatch(/127\.0\.0\.1:6379 UP/);
      
      repl._loadMasterConfig({name: "lol", ip: "127.0.0.1", port: 6379, flags: ["master", "o_down"]});
      str = repl.toString();
      expect(str).toMatch(/RedisReplica/i);
      expect(str).toMatch(/127\.0\.0\.1:6379 DOWN/);
    });

    it("works with slaves", function () {
      var repl = new RedisReplica("lol", null, {});
      repl._loadSlaveConfigs([
        {name: "lol", ip: "10.0.0.1", port: 6379, flags: ["slave"]},
        {name: "lol", ip: "10.0.0.1", port: 6380, flags: ["slave", "s_down"]},
        {name: "lol", ip: "10.0.0.1", port: 6381, flags: ["slave"]}
      ]);
      var str = repl.toString();
      expect(str).toMatch(/RedisReplica/i);
      expect(str).toMatch(/10\.0\.0\.1:6379 UP/);
      expect(str).toMatch(/10\.0\.0\.1:6380 DOWN/);
      expect(str).toMatch(/10\.0\.0\.1:6381 UP/);
    });
  });
});
