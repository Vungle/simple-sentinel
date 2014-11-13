var events = require('events')
  , redis = require('redis')
  , RedisReplica = require('./redisReplica')
  , RedisConfigFetcher = require('./redisConfigFetcher')
  , RedisWatcher = require('./redisWatcher')
  , util = require('./util');


// This is passed into the RedisReplica, so that the client redis objects are their own:
var client_redis = null;

// Uncomment this to debug the redis protocol stuffs:
// redis.debug_mode = true;


function RedisSentinel(sentinels, options) {
  if (!(this instanceof RedisSentinel)) {
    return new RedisSentinel(sentinels, options);
  }

  var sentinel = this;

  // Add in the things that will be asynchronously populated later:
  this.fetcher = null;
  this.watcher = null;
  this.replicas = {};
  
  // Simple validation:
  RedisSentinel._validateSentinelList(sentinels);

  // Extend the default values with the custom parameters:
  var defaults = {
    commandTimeout:     1500,
    createClient:       (client_redis && client_redis.createClient) || redis.createClient,
    debugLogging:       false,
    outageRetryTimeout: 5000,
    redisOptions:       {},
    refreshTimeout:     60000,
    timeout:            500,
    watchedNames:       null,
  };

  this.options = util._.extend(defaults, options);
  
  this._log.configure(this.options);

  this._log("Has client redis:", !!client_redis);

  // Store connection info for all the sentinels:
  this.sentinels = sentinels.map(function (conf) {
    var host = String(conf.host)
      , port = parseInt(conf.port, 10) || 26379;

    return { host: host, port: port };
  });

  // Start this sucker on its way:
  this._connectSentinel();
}

// Inherit from EventEmitter, so we can emit stuff:
util.inherits(RedisSentinel, events.EventEmitter);


/**
 * Will do basic validation on a sentinel list. Throws if there was a problem.
 * 
 * @param  {Array} sentinels The sentinel list, from the user.
 */
RedisSentinel._validateSentinelList = function _validateSentinelList(sentinels) {
  
  // First, check type:
  if (!sentinels || !Array.isArray(sentinels)) {
    throw new TypeError("First argument needs to be an array");
  }

  // Now go through each item in the list, and make sure that there's the necessary info:
  sentinels.forEach(function (item, idx) {
    if (typeof item !== 'object') {
      throw new TypeError("Item #" + idx + " in sentinels array isn't an object");
    }
    if (!item.host || typeof item.host !== 'string') {
      throw new Error("Item #" + idx + " in sentinels array doesn't have a correct host property");
    }
  });
};



// Logger:
RedisSentinel.prototype._log = util.buildLogger("RedisSentinel");


/**
 * Will try to connect to each item in the sentinels array, in order, until it is
 * successful.
 */
RedisSentinel.prototype._connectSentinel = function _connectSentinel() {
  var sentinel = this;

  this._log("Starting sentinel connection...");

  // Make sure we are iterating over the sentinels in a random order:
  util.shuffleArray(this.sentinels);

  // Try them all!
  util.async.forEachSeries(
    this.sentinels,
    function withEachSentinel(conf, next) {
      
      var fetcher = sentinel.fetcher = new RedisConfigFetcher(conf.host, conf.port, sentinel.options)
        .once('error', _onError)
        .once('connected', _onConnect);

      // Errors at this stage mean that we will move to the next sentinel:
      function _onError() {
        fetcher.removeListener('connected', _onConnect);
        next();
      }

      // Else, cool. Re-hook this thing up in a more stable way, and ask it for a config:
      function _onConnect() {
        fetcher.removeListener('error', _onError);

        // Hook up the event handlers for the long run:
        fetcher
          .on('error', sentinel._handleErrorAndReconnect.bind(sentinel))
          .on('config', _onGetReplInfo);

        // Now, create a watcher to poke this sucker along:
        sentinel.watcher = new RedisWatcher(conf.host, conf.port, sentinel.options)
          .on('error', sentinel._handleErrorAndReconnect.bind(sentinel))
          .on('event', _passAlongEvent)
          .on('refresh', fetcher.updateConfigs.bind(fetcher));

        function _passAlongEvent(channel, msg) {
          sentinel.emit('event', channel, msg);
        }
        
        function _onGetReplInfo(name, master, slaves) {

          // Create a new RedisReplica if we've never seen this name before:
          if (!sentinel.replicas.hasOwnProperty(name)) {
            sentinel.replicas[name] = new RedisReplica(name, sentinel.createClient, sentinel.redisOptions);
          }

          // Load the master / slave configs into the struct:
          var repl           = sentinel.replicas[name]
            , master_changed = repl._loadMasterConfig(master)
            , slaves_changed = repl._loadSlaveConfigs(slaves)
            , has_changed    = master_changed || slaves_changed;

          sentinel._log("Repl configuration set:", repl.toString());

          // Emit the repl if things are different:
          if (has_changed) {
            sentinel._log("Repl", name, "has changed");
            sentinel.emit('change', name, repl);
          }
        }
      }
    },
    function (err) {
      if (err) { return cb(err); }

      // We made it through all endpoints. What do??
      if (sentinel.options.outageRetryTimeout < 0) {
        // Stop, and emit error:
        sentinel.emit("error", new Error("Could not connect to a sentinel. *<:'O("));
        return;

      } else {
        // Loop around and try again in a few seconds:
        sentinel._log("All sentinels down. Pausing before retry...");
        setTimeout(sentinel._connectSentinel.bind(sentinel), sentinel.options.outageRetryTimeout);
      }
    }
  );
};


RedisSentinel.prototype._handleErrorAndReconnect = function _handleErrorAndReconnect(err) {

  // Log the error:
  this._log("Error encountered:", err);

  // Kill our redis clients:
  if (this.fetcher) { this.fetcher.kill(); }
  if (this.watcher) { this.watcher.kill(); }
  this.fetcher = this.watcher = null;

  // Trigger a re-connect:
  this._connectSentinel();
};


// Exports:
module.exports.RedisSentinel = RedisSentinel;

// Internal API for passing along the client's Redis library:
module.exports.setClientRedis = function setClientRedis(mod) {
  client_redis = mod;
};
