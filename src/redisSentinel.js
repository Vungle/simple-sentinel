var events = require('events')
  , redis = require('redis')
  , util = require('./util');

var client_redis = null;


function RedisSentinel(sentinels, options) {
  if (!(this instanceof RedisSentinel)) {
    return new RedisSentinel(sentinels, options);
  }

  // Extend the default values with the custom parameters:
  var defaults = {
    watchedNames: null,
    createClient: client_redis && client_redis.createClient,
    redisOptions: {}
  };
  
  this.options = _.extend(defaults, options);

  
}

// Inherit from EventEmitter, so we can emit stuff:
util.inherits(RedisSentinel, events.EventEmitter);


module.exports.RedisSentinel = RedisSentinel;

// Internal API for passing along the client's Redis library:
module.exports.setClientRedis = function setClientRedis(mod) {
  client_redis = mod;
};
