/** 
 * Represents a group of redis servers, or a Replica.
 * 
 * @param {Function} createClient The function used to create a user's RedisClient.
 * @param {Object}   options      Custom configurations for a user's RedisClient.
 */
function RedisReplica(createClient, options) {
  this.master = null;
  this.slaves = null;
  this.createClient = createClient;
  this.redisOptions = options;
}


/**
 * Will copy a configuration into this object, checking for changes.
 * 
 * @param  {Object} master The config object for the master, from redis-sentinel.
 * @param  {Array}  slaves An array of slave configuration objects, from redis-sentinel.
 * @return {Boolean}       True IFF the provided configurations are different to the one currently stored.
 */
RedisReplica.prototype._loadConfigs = function _loadConfigs(master, slaves) {
  
}


RedisReplica.prototype.connectMaster = function connectMaster() {
  if (!this.master) { return null; }
  return this.createClient.call(null, this.master.port, this.master.ip, this.redisOptions);
};

RedisReplica.prototype.connectSlave = function connectSlave() {
  if (!this.slaves) { return null; }
  var idx = Math.floor( Math.random() * this.slaves.length );
  var slave = this.slaves[idx];
  return this.createClient.call(null, slave.port, slave.ip, this.redisOptions);
};

RedisReplica.prototype.connectAllSlaves = function connectAllSlaves() {
  if (!this.slaves || !this.slaves.length) { return []; }

  var repl = this;
  return this.slaves.map(function connect(slave) {
    return repl.createClient.call(null, slave.port, slave.ip, repl.redisOptions);
  });
};

module.exports = RedisReplica;
