var RedisWatcher = require('../src/RedisWatcher');

var REDIS_HOST = 'localhost';
var REDIS_PORT = 6379;

describe("RedisWatcher", function () {
  it("emits 'refresh' on startup");
  it("emits 'refresh' after period of no changes");
  it("emits 'refresh' after change");
  it("emits 'event' after events");
  it("suppresses 'refresh' when plenty of changes");
  it("emits 'error' on hangup");
});
