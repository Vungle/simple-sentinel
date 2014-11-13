var events = require('events')
  , redis = require('redis')
  , RedisReplica = require('./redisReplica')
  , RedisWatcher = require('./redisWatcher')
  , util = require('./util');

var client_redis = null;

// redis.debug_mode = true;

function RedisSentinel(sentinels, options) {
  if (!(this instanceof RedisSentinel)) {
    return new RedisSentinel(sentinels, options);
  }

  var sentinel = this;

  // Add in the things that will be asynchronously populated later:
  this.client = null;
  this.watcher = null;
  this.connect_info = null;
  this.replicas = {};
  this.refresh_timeout = undefined;

  // States:
  this.needs_refresh = false;
  this.refresh_running = false;

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

  this._log("Has client redis:", !!client_redis);

  // Store connection info for all the sentinels:
  this.sentinels = sentinels.map(function (conf) {
    var host = conf.host
      , port = conf.port || 26379;

    return { host: host, port: port };
  });

  // Try to connect a sentinel:
  this._connectSentinel(_setupClient);

  function _setupClient(err, client) {
    if (err) {
      sentinel.emit("error", err);
      return;
    }

    // Keep track of the client:
    client.once('end', function () {
      sentinel._log("REDIS ENDED OMG");
      sentinel._connectSentinel(_setupClient);
    });

    // Else, we have a sentinel connection, so store it, and try to fetch configs:
    sentinel.client = client;
    sentinel._refreshConfigs(_startUpdateStream);
  }

  function _startUpdateStream(err) {
    if (err) {
      // Error doing stuff. Re-connect sentinel and try again:
      sentinel._log("Error during config loading:", err);
      sentinel._connectSentinel(_setupClient);
      return;
    }

    // Else, we are ok. Open a streaming channel to the sentinel, and use that to force
  }
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


/** 
 * Will take in the response from a "SENTINEL MASTERS" command, and return a parsed struct.
 *
 * @param  {String} role   The role of the server, like "Master". Only used for logging.
 * @param  {Array}  result The response from SENTINEL MASTERS.
 * @return {Object}       An object like: {"name": {ip: "...", ...}, ...} if ok. null otherwise
 */
RedisSentinel.prototype._parseServerList = function _parseServerList(role, result) {
  var i, len, out = [];

  var ns = role + " list rejected:";

  if (!result || !Array.isArray(result)) {
    this._log(ns, "Bad input.");
    return null;
  }
  
  for (i=0,len=result.length; i<len; i++) {
    var row = result[i], row_len, j, parsed_row = {};

    if (!Array.isArray(row) || row.length % 2 === 1) {
      this._log(ns, "Malformed row");
      return null;
    }
    
    for (j=0,row_len=row.length; j<row_len; j+=2) {
      var key = row[j], value = row[j+1];

      if (parsed_row.hasOwnProperty(key)) {
        this._log(ns, "Row had duplicate property");
        return null;
      }

      // Special-case for port entries:
      if (key === "port") {
        try {
          value = parseInt(value, 10);
        } catch (ex) {
          this._log(ns, "Row has a non-numeric port");
          return null;
        }
      }

      // Special-case for flags:
      if (key === "flags") {
        value = value.split(",");
      }
      
      parsed_row[key] = value;
    }

    if (!parsed_row.hasOwnProperty("name")) {
      this._log(ns, "Row lacked a name property");
      return null;
    }
    
    out.push(parsed_row);
  }

  return out;
};


/**
 * Will build a lookup table for a list based on the "name" property of the contents.
 * 
 * @param  {Array} array An array of objects, such as those returned from _parseServerList()
 * @return {Object}      A lookup table of objects in array from the name property to the elements.
 *                       Returns null on failure or duplicates.
 */
RedisSentinel.prototype._buildLookup = function _buildLookup(array) {
  if (!array) {
    // Error probably happened in earlier parsing. Just fail w/o logging:
    return null;
  }

  var ns = "Failed to build lookup:";

  if (!Array.isArray(array)) {
    this._log(ns, "Non-array provided");
    return null;
  }

  var i, len = array.length, out = {};
  for (i=0; i<len; i++) {
    var item = array[i];
    
    if (!item.hasOwnProperty("name")) {
      this._log(ns, "Item #", i, "has no name");
      return null;
    }
    
    if (out.hasOwnProperty(item.name)) {
      this._log(ns, "Duplicate name in array:", item.name);
    }
    
    out[item.name] = item;
  }

  return out;
};


/**
 * Extremely simple and basic validation of the INFO response for a sentinel:
 * @param  {String}  info_data The string response from an INFO command.
 * @return {Boolean}           True IFF we're accepting it.
 */
RedisSentinel.prototype._isInfoResponseValid = function _isInfoResponseValid(info_data) {
  if (!info_data || typeof info_data !== 'string') {
    this._log("INFO failed: Bad response");
    return false;
  }

  if (info_data.indexOf("# Sentinel") < 0) {
    this._log("INFO failed: Server is not a sentinel");
    return false;
  }

  return true;
};


/**
 * A simple logging function. Will write to stdout IFF we were told to in the user configs.
 * Arguments are the same format as for node util's format function, with the exception that
 * all instances of Error with a 'stack' property are evaluated as that, and as a string
 * otherwise.
 */
RedisSentinel.prototype._log = function _log() {
  if ( ! this.options.debugLogging) { return; }

  var i, len = arguments.length;
  for (i=0; i<len; i++) {
    var arg = arguments[i];
    if (arg instanceof Error) {
      arguments[i] = (arg.stack) ? arg.stack : String(arg);
    }
  }
  var str = util.format.apply(util, arguments);
  console.log("Sentinel:", str);
}


/**
 * Will try to connect to each item in the sentinels array, in order, until it is
 * successful.
 */
RedisSentinel.prototype._connectSentinel = function _connectSentinel() {
  var sentinel = this;

  this._log("Starting sentinel connection...");

  // Blank client and connection info, to be sure:
  this.client = this.connect_info = null;

  // Make sure we are iterating over the sentinels in a random order:
  util.shuffleArray(this.sentinels);

  // Try them all!
  util.async.forEachSeries(
    this.sentinels,
    function withEachSentinel(conf, next) {
      var redis_config = {
        connect_timeout: sentinel.options.timeout, // Don't connect to down things
        max_attempts:    1,                        // No retry logic, since we try to handle that
        no_ready_check:  1                         // Don't do a ready check, since we do a check.
      };
      var client = redis.createClient(conf.port, conf.host, redis_config);
      
      function _onReady() {
        client.removeListener('error', _onError);

        sentinel._log("Successfully connected to %s:%d", conf.host, conf.port);
        
        util.timedCommand(client, sentinel.options.commandTimeout, "INFO", function (err, result) {
          if (err) {
            sentinel._log("INFO failed:", err);
            client.end();
            return next();
          }

          if (!sentinel._isInfoResponseValid(result)) {
            client.end();
            return next();
          }

          // Else, we're accepting it, so store connection string and continue
          // into the refreshConfig logic:
          sentinel.connect_info = conf;
          sentinel.client = client;

          // Connect to a streaming source:
          sentinel.watcher = new RedisWatcher(
            conf.host, conf.port,
            sentinel.options.refreshTimeout,
            sentinel.options.commandTimeout
          );

          sentinel.watcher.on('refresh', function () {
            sentinel._log("Watcher recommends refresh");
          });

          sentinel.watcher.on('error', function (err) {
            sentinel._log("Watcher error", err);
          });

          sentinel._refreshConfigs();
        });
      }

      function _onError() {
        client.removeListener('ready', _onReady);
        client.end();
        sentinel._log("Failed to connect to %s:%d", conf.host, conf.port);
        next();
      }

      client.once('ready', _onReady);
      client.once('error', _onError);
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

  // Blank connection info:
  this.connect_info = null;
  
  // Kill our redis clients:
  if (this.client) { this.client.end(); }
  if (this.watcher) { this.watcher.kill(); }
  this.client = this.watcher = null;

  // Reset refresh variables:
  this.needs_refresh = false;
  this.refresh_running = false;
  clearTimeout(this.refresh_timeout);
  this.refresh_timeout = undefined;

  // Trigger a re-connect:
  this._connectSentinel();
};


RedisSentinel.prototype._refreshConfigs = function _refreshConfigs() {
  var sentinel = this;

  var cmd_to = sentinel.options.commandTimeout;
  // If we're already doing a refresh, then flag that we need to do another and return:
  if (this.refresh_running) {
    this.needs_refresh = true;
    return;
  }

  sentinel._log("Refreshing replica configurations...");

  // Set the state vars:
  this.needs_refresh = false;
  this.refresh_running = true;

  // We are running, which cancels any existing timeouts:
  clearTimeout(this.refresh_timeout);
  
  // Fetch the masters, so that we can select the ones with server configs:
  util.timedCommand(this.client, cmd_to, "SENTINEL", ["masters"], function (err, res) {
    if (err) {
      sentinel._handleErrorAndReconnect(err);
      return;
    }

    var all_masters     = sentinel._buildLookup(sentinel._parseServerList("Master", res))
      , tracked_names   = sentinel.options.watchedNames || Object.keys(all_masters)
      , tracked_masters = {};

    // Select all masters that are in the list of watched names:
    tracked_names.forEach(function (name) {
      if ( !all_masters.hasOwnProperty(name) ) {
        sentinel._log("Warning: Replica name in watchedNames but not on Sentinel:", name);
        return;
      }
      tracked_masters[name] = all_masters[name];
      if (!sentinel.replicas.hasOwnProperty(name)) {
        sentinel.replicas[name] = new RedisReplica(name, sentinel.createClient, sentinel.redisOptions);
      }
    });

    // Items may have been removed from tracked_names to tracked_masters, if the name isn't
    // tracked by the sentinel:
    tracked_names = Object.keys(tracked_masters);

    // Now pull in all slave configurations:
    var has_errored = false;
    util.async.each(
      tracked_names,
      function fetchSlaves(name, done) {
        util.timedCommand(sentinel.client, cmd_to, "SENTINEL", ["slaves", name], function (err, slaves) {
          // We have to maintain the 'has_errored' thing, since async will call the allDone function
          // before all tasks have returned in case of error, which is very bad, but a documented
          // "feature" of async. :-/
          if (err || has_errored) { 
            has_errored = true;
            return done(err);
          }

          // Parse the slave data:
          var parsed_slaves = sentinel._parseServerList("Slave", slaves);

          var repl           = sentinel.replicas[name]
            , master_changed = repl._loadMasterConfig(tracked_masters[name])
            , slaves_changed = repl._loadSlaveConfigs(parsed_slaves)
            , has_changed    = master_changed || slaves_changed;

          // Emit the repl if things are different:
          if (has_changed) {
            sentinel._log("Change detected for:", name);
            sentinel.emit('change', name, repl);
          }

          sentinel._log("Loaded data:", repl.toString());
          done();
        });
      },
      function allDone(err) {
        if (err) {
          sentinel._handleErrorAndReconnect(err);
          return;
        }

        // Ok, done running:
        sentinel.refresh_running = false;

        // Do we already have another refresh scheduled?
        if (sentinel.needs_refresh) {
          this._refreshConfigs();
          return;
        }

        // Else, we should set a timeout and wait:
        sentinel._log("All replicas handled");
        sentinel.refresh_timeout = setTimeout(
          sentinel._refreshConfigs.bind(sentinel),
          sentinel.options.refreshTimeout
        );
      }
    );
  });
}


// Exports:
module.exports.RedisSentinel = RedisSentinel;

// Internal API for passing along the client's Redis library:
module.exports.setClientRedis = function setClientRedis(mod) {
  client_redis = mod;
};
