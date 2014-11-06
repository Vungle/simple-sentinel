var util           = require('./util')
  , redis_sentinel = require('./redisSentinel')
  , client_redis   = util.parentRequire('redis');

// Pass the client's redis up the chain:
redis_sentinel.setClientRedis(client_redis);

module.exports = redis_sentinel.RedisSentinel;
