var util   = require('./util')
  , redis  = require('redis')
  , events = require('events');


var USEFUL_EVENTS = [
  // These guys are useful, as slaves / masters toggle on and off:
  "+sdown", "-sdown", "+odown", "-odown",

  // These are useful to see when failovers happen:
  "+reset-master", "switch-master",

  // Things the the outside public might be interested in:
  "failover-end", "no-good-slave"
];

/**
 * Will create a RedisWatcher object, which opens the pub/sub channel
 * with a sentinel, and emits events when things should happen.
 * 
 * @param {String} host    The host to connect to.
 * @param {Number} port    The port num.
 * @param {Number} rate    The maximum number of milliseconds between 'poll' events.
 * @param {Number} timeout The timeout used when waiting for query responses
 */
function RedisWatcher(host, port, rate, timeout) {
  this.host = host;
  this.port = port;
  this.rate = rate;
  this.finalized = false;
  this.timeout = undefined;
  this.client = redis.createClient(port, host);
  this.client.on  ('error', this._handleClientError.bind(this));
  this.client.once('ready', this._handleConnectReady.bind(this));

  this._resetTimer();
}

util.inherits(RedisWatcher, events.EventEmitter);


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
  console.log("** WATCHER KILLED");
}


RedisWatcher.prototype._handleClientError = function _handleClientError(err) {
  if (this.finalized) { return; }
  this.kill(err);
};


RedisWatcher.prototype._handleConnectReady = function _handleConnectReady() {
  if (this.finalized) { return; }
  
  // Start listening for interesting events:
  this.client.subscribe.apply(this.client, USEFUL_EVENTS);
  this.client.on('message', function (channel, message) {
    console.log("EVENT", channel, message);
  });
};


RedisWatcher.prototype._resetTimer = function _resetTimer() {
  var updater = this;

  clearTimeout(this.timeout);
  
  this.timeout = setTimeout(function () {
    updater.emit('refresh');
    updater._resetTimer();
  }, this.rate);
};


module.exports = RedisWatcher;
