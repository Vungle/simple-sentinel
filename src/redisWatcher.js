var util   = require('./util')
  , redis  = require('redis')
  , events = require('events');


// === Events Emitted =====
// error(err), refresh(), event()
// ========================

var RELOAD_EVENTS = [
  // These guys are useful, as slaves / masters toggle on and off:
  "+sdown", "-sdown", "+odown", "-odown",

  // These are useful to see when failovers happen according to the docs:
  "+reset-master", "switch-master",

  // These are useful to see when failovers happen via experimentation:
  "+role-change", "-role-change", "+switch-master"
];

var INTERESTING_EVENTS = [
  // Things the the outside public might be interested in:
  "+slave", "failover-end", "no-good-slave"
];

var USEFUL_EVENTS = RELOAD_EVENTS.concat(INTERESTING_EVENTS);


/**
 * Will create a RedisWatcher object, which opens the pub/sub channel
 * with a sentinel, and emits events when things should happen.
 * 
 * @param {String} host    The host to connect to.
 * @param {Number} port    The port num.
 * @param {Number} config  The config object passed to the RedisSentinel.
 */
function RedisWatcher(host, port, config) {
  this.finalized = false;

  this.host = host;
  this.port = port;
  this.config = config;

  this.timeout = undefined;

  this._log.configure(config);

  var redis_config = {
    connect_timeout: config.timeout,
    max_attempts:    1
  };

  // Hook ourselves into a redis client:
  this.client = redis.createClient(port, host, redis_config)
    .on  ('error', this._handleClientError.bind(this))
    .on  ('end',   this._handleClientHangup.bind(this))
    .once('ready', this._handleConnectReady.bind(this));

  // Emit a starting refresh, but do it on next tick to give outside time to listen:
  this._log("Refreshing due to init");
  process.nextTick(this.emit.bind(this, 'refresh'));

  // Start the timer:
  this._resetTimer();
}

util.inherits(RedisWatcher, events.EventEmitter);


RedisWatcher.prototype._log = util.buildLogger("RedisWatcher");

/** 
 * Will halt the updater, closing all connections and freeing all assets.
 * @param  {Error} err  An error to emit when done. Optional.
 */
RedisWatcher.prototype.kill = function (err) {
  if (this.finalized) { return; }
  this.finalized = true;
  this.client.end();
  this.client.removeAllListeners();
  clearTimeout(this.timeout);
  if (err) { this.emit("error", err); }
  this._log("Closed connection to %s:%d", this.host, this.port);
}


RedisWatcher.prototype._handleClientError = function _handleClientError(err) {
  if (this.finalized) { return; }
  this.kill(err);
};


RedisWatcher.prototype._handleClientHangup = function _handleClientHangup() {
  this._log("Redis connection closed");
  this.kill();
};


RedisWatcher.prototype._handleConnectReady = function _handleConnectReady() {
  if (this.finalized) { return; }
  
  var watcher = this;

  // Start listening for interesting events:
  this.client.subscribe.apply(this.client, USEFUL_EVENTS);
  this.client.on('message', function (channel, message) {
    if (watcher.finalized) { return; }

    watcher._log("Got event:", channel, message);

    // Emit for clients:
    watcher.emit("event", channel, message);

    // Are we interested in this event?
    if (RELOAD_EVENTS.indexOf(channel) >= 0) {
      watcher._log("Refreshing due to", channel, "event");
      watcher.emit('refresh');
      watcher._resetTimer();
    }
  });
};


RedisWatcher.prototype._resetTimer = function _resetTimer() {
  var watcher = this;

  clearTimeout(this.timeout);
  
  this.timeout = setTimeout(function () {
    watcher._log("Refreshing due to timeout");
    watcher.emit('refresh');
    watcher._resetTimer();
  }, this.config.refreshTimeout);
};


module.exports = RedisWatcher;
