var events = require('events')
  , redis = require('redis')
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

  // Simple validation:
  RedisSentinel._validateSentinelList(sentinels);

  // Extend the default values with the custom parameters:
  var defaults = {
    createClient:       (client_redis && client_redis.createClient) || redis.createClient,
    debugLogging:       false,
    redisOptions:       {},
    watchedNames:       null,
    timeout:            500,
    commandTimeout:     1500,
    outageRetryTimeout: 5000
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
    sentinel._loadConfigs();
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
 * @param  {Array} result The response from SENTINEL MASTERS.
 * @return {Object}       An object like: {"name": {ip: "...", ...}, ...} if ok. null otherwise
 */
RedisSentinel.prototype._parseMastersList = function _parseMastersList(result) {
  var i, len, out = {};

  var ns = "Master list rejected:";

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

    if (out.hasOwnProperty(parsed_row.name)) {
      this._log(ns, "Duplicate rows with name:", parsed_row.name);
      return null;
    }
    
    out[parsed_row.name] = parsed_row;
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
 * Will dispatch a Redis command that can time out.
 * 
 * @param  {RedisClient} client The redis client to use.
 * @param  {String}      cmd    The command name.
 * @param  {String}      opts   An array of options. Optional.
 * @param  {Function}    cb     Called with (err, results)
 */
RedisSentinel.prototype._timedCommand = function _timedCommand(client, cmd, opts, cb) {
  if (!cb) {
    cb = opts;
    opts = [];
  }

  cb = util._.once(cb);

  var timeout_err = new Error("Command timed out");
  var cmd_timeout = setTimeout( cb.bind(null, timeout_err), this.options.commandTimeout );

  client.send_command(cmd, opts, function () {
    clearTimeout(cmd_timeout);
    cb.apply(null, arguments);
  });
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
 * 
 * @param  {Function} cb Called when done with args: (err, client)
 */
RedisSentinel.prototype._connectSentinel = function _connectSentinel(cb) {
  var sentinel = this;

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
        
        sentinel._timedCommand(client, "INFO", function (err, result) {
          if (err) {
            sentinel._log("INFO failed:", err);
            client.end();
            return next();
          }

          if (!sentinel._isInfoResponseValid(result)) {
            client.end();
            return next();
          }

          cb(null, client);
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

      // We made it through all endpoint, so loop around and try again in a few seconds:
      sentinel._log("All sentinels down. Pausing before retry...");
      setTimeout(sentinel._connectSentinel.bind(sentinel, cb), sentinel.options.outageRetryTimeout);
    }
  );
};


RedisSentinel.prototype._loadConfigs = function _loadConfigs(cb) {
  var sentinel = this;

  this._timedCommand(this.client, "SENTINEL", ["masters"], function (err, res) {
    if (err) { return cb(err); }

    var all_masters     = sentinel._parseMastersList(res)
      , tracked_names   = sentinel.options.watchedNames || Object.keys(all_masters)
      , tracked_masters = {};

    tracked_names.forEach(function (name) {
      if ( !all_masters.hasOwnProperty(name) ) {
        sentinel._log("Warning: Replica name in watchedNames but not on Sentinel:", name);
        return;
      }
      tracked_masters[name] = all_masters[name];
    });

    console.log(tracked_masters);
    
    return;
  });
}


// Exports:
module.exports.RedisSentinel = RedisSentinel;

// Internal API for passing along the client's Redis library:
module.exports.setClientRedis = function setClientRedis(mod) {
  client_redis = mod;
};
