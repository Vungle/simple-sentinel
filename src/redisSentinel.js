var events = require('events')
  , util = require('./util');

var client_redis = null;


function RedisSentinel(sentinels, options) {
  if (!(this instanceof RedisSentinel)) {
    return new RedisSentinel(sentinels, options);
  }

  // Take the options with the default values:
  this.options = _.extend(options, {
    watchedReplicaNames: null
    createClient:        client_redis && client_redis.createClient
  });
}

// Inherit from EventEmitter, so we can emit stuff:
util.inherits(RedisSentinel, events.EventEmitter);


module.exports.RedisSentinel = RedisSentinel;

// Internal API for passing along the client's Redis library:
module.exports.setClientRedis = function setClientRedis(mod) {
  client_redis = mod;
};
