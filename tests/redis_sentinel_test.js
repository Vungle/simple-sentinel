var RedisSentinel = require('../src/redisSentinel');

describe("RedisSentinel", function () {
  describe("when constructing", function () {
    it("rejects a bad sentinel list");
    it("will allow overrides to options");
    it("works as both a constructor and a function call");
  });

  describe("when connecting", function () {
    it("will dodge bad connections");
    it("will dodge timeouts");
    it("will dodge non-sentinels");
    it("will retry if so configured");
    it("will error if so configured");
    it("will find a server");
    it("will detect and not emit when no change");
    it("will detect and emit on changes");
    it("will emit events");
    it("will reconnect on errors");
  });
});
