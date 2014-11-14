var RedisConfigFetcher = require('../src/redisConfigFetcher');

describe("RedisConfigFetcher", function () {
  describe("during initialization", function () {
    it("emits 'error' on connection error");
    it("emits 'error' on client close");
    it("emits 'error' on timeout");
    it("emits 'error' with non-sentinel");
    it("emits 'connected' with sentinel");
  });

  describe("when using isInfoResponseValid", function () {
    it("detects null as non-sentinel");
    it("detects a normal info as non-sentinel");
    it("detects a sentinel info as such");
  });

  describe("when parsing a server list", function () {
    it("rejects bad types");
    it("rejects odd number of items in list");
    it("rejects dupe properties");
    it("rejects non-numeric ports");
    it("rejects missing name");
    it("parses flags as array");
    it("parses multiple rows");
  });

  describe("when building a lookup", function () {
    it("fails on non-arrays");
    it("fails when something lacks a name");
    it("fails with duplicate names");
    it("works when everything is ok");
  });

  describe("when updating configs", function () {
    it("emits 'error' when timeout");
    it("emits 'error' when bad results from masters command");
    it("emits 'error' when bad results from slaves command");
    it("emits 'config' with correct values");
    it("runs one update at a time");
  });
});
