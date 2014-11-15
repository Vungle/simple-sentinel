var RedisReplica = require('../src/RedisReplica')
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
          ip: "127.0.0.2",
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
});
