var RedisReplica = require('../src/redisReplica')
  , mockRandom = require('./util/mockRandom')
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
      
      // RNG setup:
      mockRandom.installHooks();

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
