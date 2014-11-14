var RedisReplica = require('../src/RedisReplica');

describe('RedisReplica', function () {
  
  describe("when checking isDown", function () {
    it("handles null values");
    it("detects an up slave");
    it("detects a down slave");
    it("detects an up master");
    it("detects a down master");
  });

  describe("when loading a master config", function () {
    it("detects no change from null to null");
    it("detects change from null to config");
    it("detects change from config to null");
    it("detects no change from config to config");
    it("detects changes in ip");
    it("detects changes in port");
    it("detects changes in up/down");
  });

  describe("when loading slave configs", function () {
    it("detects no change from null to null");
    it("detects change from null to list");
    it("detects change from list to null");
    it("detects no change from list to list");
    it("detects change when lists are different length");
    it("detects change when new ip is introduces");
    it("detects change when new port is introduces");
    it("detects change when server changes up/down state");
  });
});
