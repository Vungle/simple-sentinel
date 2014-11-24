var util   = require('./util')
  , redis  = require('redis')
  , events = require('events');


// === Events Emitted =====
// error(err), connected(), config(name, master, [slave]), sentinels([sentinel])
// ========================


/**
 * A RedisConfigFetcher is responsible for connecting to a sentinel, and pulling
 * down a configuration for either specific replica names or all tracked replicas.
 * 
 * @param {String} host    The host to connect to.
 * @param {Number} port    The port to connect to.
 * @param {Object} config  The config object passed to the RedisSentinel object.
 */
function RedisConfigFetcher(host, port, config) {
  this.finalized = false;

  var fetcher = this;

  this.host = host;
  this.port = port;
  this.config = config;
  this.cmd_to = config.commandTimeout;

  // State variables:
  this.is_fetching = false;
  this.needs_another = false;

  this._log.configure(config);

  var redis_config = {
    connect_timeout: config.timeout, // Don't connect to down things
    max_attempts:    1,              // No retry logic, since we handle that ourselves
    no_ready_check:  1               // Don't do a ready check, since we already do that
  };

  var client = this.client = config._testClient || redis.createClient(port, host, redis_config);
  
  client.on('error', function (err) {
    fetcher.kill(err);
  });

  client.on('end', function () {
    fetcher._log("Redis connection closed");
    fetcher.kill();
  });

  client.once('ready', function () {
    if (fetcher.finalized) { return; }

    fetcher._log("Successfully connected to %s:%d", fetcher.host, fetcher.port);
    
    // Validate the sucker with an INFO check:
    util.timedCommand(client, fetcher.cmd_to, "INFO", function (err, result) {
      if (err || fetcher.finalized) {
        return fetcher.kill(err);
      }

      if (!RedisConfigFetcher._isInfoResponseValid(result)) {
        fetcher._log("Invalid response from sentinel");
        return fetcher.kill(new Error("Invalid response"));
      }

      fetcher.emit('connected');
    });
  });
}

util.inherits(RedisConfigFetcher, events.EventEmitter);


RedisConfigFetcher.prototype._log = util.buildLogger("RedisConfigFetcher");


/**
 * Extremely simple and basic validation of the INFO response for a sentinel:
 * @param  {String}  info_data The string response from an INFO command.
 * @return {Boolean}           True IFF we're accepting it.
 */
RedisConfigFetcher._isInfoResponseValid = function _isInfoResponseValid(info_data) {
  if (!info_data || typeof info_data !== 'string') {
    return false;
  }

  if (info_data.indexOf("# Sentinel") < 0) {
    return false;
  }

  return true;
};


/** 
 * Will take in the response from a "SENTINEL MASTERS" command, and return a parsed struct.
 *
 * @param  {String} role   The role of the server, like "Master". Only used for logging.
 * @param  {Array}  result The response from SENTINEL MASTERS.
 * @return {Object}       An object like: {"name": {ip: "...", ...}, ...} if ok. null otherwise
 */
RedisConfigFetcher.prototype._parseServerList = function _parseServerList(role, result) {
  var i, len, out = [];

  var ns = role + " list rejected:";

  if (!result || !Array.isArray(result)) {
    this._log(ns, "Bad input");
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
        value = parseInt(value, 10);
        if (isNaN(value)) {
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
RedisConfigFetcher.prototype._buildLookup = function _buildLookup(array) {
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
      return null;
    }
    
    out[item.name] = item;
  }

  return out;
};


/**
 * Will stop the Config Fetcher and release its assets. If an error
 * is provided, it will be emitted on the error channel.
 * 
 * @param  {Error} err An optional error to emit.
 */
RedisConfigFetcher.prototype.kill = function kill(err) {
  if (this.finalized) { return; }
  this.finalized = true;

  this.client.end();
  this.client.removeAllListeners();

  this.emit('error', err || new Error());

  this._log("Connection to %s:%d closed.", this.host, this.port);
};


/**
 * Will get the Fetcher to fetch some new configs. If it already is,
 * it will fetch configs immediately after it's done. The new configs
 * will be emitted on the 'config' channel.
 */
RedisConfigFetcher.prototype.updateConfigs = function updateConfigs() {
  if (this.finalized) { return; }

  var fetcher = this;

  // If we're already doing a refresh, then flag that we need to do another and return:
  if (this.is_fetching) {
    this.needs_another = true;
    return;
  }

  this._log("Refreshing replica configurations...");

  // Set the state vars:
  this.needs_another = false;
  this.is_fetching = true;

  // Fetch the masters, so that we can select the ones with server configs:
  util.timedCommand(this.client, fetcher.cmd_to, "SENTINEL", ["masters"], function (err, res) {
    if (err || fetcher.finalized) { return fetcher.kill(err); }

    // Fetch all masters as a lookup from name => parsed config object.
    var all_masters = fetcher._buildLookup(fetcher._parseServerList("Master", res));
    if (!all_masters) { return fetcher.kill(new Error("Parsing master list failed")); }

    // Get the list of watched replicas, and select only those ones from the master list:
    var tracked_names   = fetcher.config.watchedNames || Object.keys(all_masters)
      , tracked_masters = {};

    tracked_names.forEach(function (name) {
      if ( !all_masters.hasOwnProperty(name) ) {
        fetcher._log("Warning: Replica name in watchedNames but not on Sentinel:", name);
        return;
      }
      tracked_masters[name] = all_masters[name];
    });

    // Items may have been removed from tracked_names to tracked_masters, if the name isn't
    // tracked by the sentinel:
    tracked_names = Object.keys(tracked_masters);

    // We batch the sentinels in a list, and emit them all at once:
    var sentinel_list = [];

    // Now pull in all slave / sentinel configurations:
    util.async.each(
      tracked_names,
      function fetchSlaves(name, done) {
        if (fetcher.finalized) { return; }

        var tasks = [
          function _fetchSlaves(callback) {
            util.timedCommand(fetcher.client, fetcher.cmd_to, "SENTINEL", ["slaves", name], callback);
          },
          function _fetchSentinels(callback) {
            if (!fetcher.config.discoverSentinels) { return callback(null, []); }
            util.timedCommand(fetcher.client, fetcher.cmd_to, "SENTINEL", ["sentinels", name], callback);
          }
        ];

        util.async.parallel(tasks, function (err, results) {
          if (err || fetcher.finalized) {
            return fetcher.kill(err);
          }

          var slaves    = results[0]
            , sentinels = results[1];

          // Parse the slave data:
          var parsed_slaves = fetcher._parseServerList("Slave", slaves);
          if (!parsed_slaves) { return fetcher.kill(new Error("Parsing slave list failed")); }

          // Parse the sentinel data:
          var parsed_sentinels = fetcher._parseServerList("Sentinel", sentinels);
          if (!parsed_sentinels) {
            fetcher._log("Warning: Sentinel parsing failed. No sentinels added.");
            parsed_sentinels = [];
          }

          // Add the sentinel connection info to the list of things to emit:
          parsed_sentinels = parsed_sentinels.map(function (data) {
            return { host: data.ip, port: data.port };
          });
          sentinel_list.push.apply(sentinel_list, parsed_sentinels);

          // Pass the config along to the outside:
          fetcher.emit('config', name, tracked_masters[name], parsed_slaves);
          done();
        });
      },
      function allDone(err) {
        if (err || fetcher.finalized) { return fetcher.kill(err); }

        // Ok, done running:
        fetcher.is_fetching = false;

        // Emit the deduped sentinels, if we have any:
        if (sentinel_list.length) {
          sentinel_list = util._.uniq(sentinel_list, function (s) { return s.host + ":" + s.port; });
          fetcher.emit('sentinels', sentinel_list);
        }

        fetcher._log("Done fetching configs");

        // Do we already have another refresh scheduled?
        if (fetcher.needs_another) {
          return process.nextTick(fetcher.updateConfigs.bind(fetcher));
        }
      }
    );
  });
}


module.exports = RedisConfigFetcher;
