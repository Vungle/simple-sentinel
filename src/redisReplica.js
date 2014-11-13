var util = require('./util');

/** 
 * Represents a group of redis servers, or a Replica.
 *
 * @param {String}   name         The name of the Replica set in redis-sentinel.
 * @param {Function} createClient The function used to create a user's RedisClient.
 * @param {Object}   options      Custom configurations for a user's RedisClient.
 */
function RedisReplica(name, createClient, options) {
  this.name   = name;
  this.master = null;
  this.slaves = null;
  this.createClient = createClient;
  this.redisOptions = options;
}


/**
 * Used to detect if a config is down or not. Very simple.
 * @param  {String}  role   Either "master" or "slave".
 * @param  {Object}  config A parsed config from redis-sentinel.
 * @return {Boolean}        True IFF we are considering this link down.
 */
RedisReplica._isDown = function _isDown(role, config) {
  if (!config) { return true; }

  // We're using O_DOWN for masters, S_DOWN for slaves as being the "down" criterea.
  // There might be a better value, but this'll do for now...
  var look_for = (role === "master") ? "o_down" : "s_down";
  return (config.flags || []).indexOf(look_for) >= 0;
};


/**
 * Will copy the master configuration into this object, checking for changes.
 * 
 * @param  {Object} master The config object for the master, from redis-sentinel.
 * @param  {Array}  slaves An array of slave configuration objects, from redis-sentinel.
 * @return {Boolean}       True IFF the provided configurations are different to the one currently stored.
 */
RedisReplica.prototype._loadMasterConfig = function _loadConfigs(master) {
  var old_host = this.master && this.master.ip
    , old_port = this.master && this.master.port
    , old_dead = RedisReplica._isDown("master", this.master)
    , has_changed = (old_host !== master.ip)
                 || (old_port !== master.port)
                 || (old_dead !== RedisReplica._isDown("master", master));
  
  // Reject if the name changed:
  if (master.name !== this.name) { throw new Error("Config loaded into wrong Replica!"); }

  this.master = master;

  return has_changed;
};


RedisReplica.prototype._loadSlaveConfigs = function _loadSlaveConfigs(slaves) {
  // Special case: Different number of slaves === for sure something changed:
  if (!this.slaves || this.slaves.length !== slaves.length) {
    this.slaves = slaves;
    return true;
  }

  // Else, we've only chaged if:
  // a) a server (ip, port) in the old list isn't in the new one
  // b) a server (ip, port)'s up/down status changed from the old list to the new list.
  
  var i
    , j
    , old_slave
    , new_slave
    , len = this.slaves.length
    , has_changed = false;

  // For each slave in the old list...
  for (i=0; i<len; i++) {
    old_slave = this.slaves[i];
    
    // ... locate the slave in the new list:
    for(j=0; j<len; j++) {
      new_slave = slaves[j];
      if (old_slave.ip === new_slave.ip && old_slave.port === new_slave.port) {
        break; // Found.
      }
    }

    // Did we not find anything?
    if (j === len) {
      has_changed = true;
      break;
    }

    // Else, we did find something, so check to see if online/offline status changed:
    if (RedisReplica._isDown("slave", old_slave) !== RedisReplica._isDown("slave", new_slave)) {
      has_changed = true;
      break;
    }
  }

  // Store and return:
  this.slaves = slaves;
  return has_changed;
}


/**
 * Will get a connection to the master, if it's alive.
 * @return {RedisClient} The RedisClient for this replica's master, or null if the server is down.
 */
RedisReplica.prototype.connectMaster = function connectMaster() {
  if (!this.master || RedisReplica._isDown("master", this.master)) { return null; }
  return this.createClient.call(null, this.master.port, this.master.ip, this.redisOptions);
};


/**
 * Will connect to a random living slave.
 * @return {RedisClient} The RedisClient for a random living slave, or null if all slaves are down.
 */
RedisReplica.prototype.connectSlave = function connectSlave() {
  if (!this.slaves) { return null; }
  
  var living_slaves = this.slaves.filter(function (slave) {
    return ! RedisReplica._isDown("slave", slave);
  });

  if (living_slaves.length === 0) { return null; }

  var idx = Math.floor( Math.random() * this.slaves.length );
  var slave = this.slaves[idx];

  return this.createClient.call(null, slave.port, slave.ip, this.redisOptions);
};


/**
 * Will connect to all living slaves.
 * @return {Array} An array containing RedisClients for all living slaves. If no living slaves, returns [].
 */
RedisReplica.prototype.connectAllSlaves = function connectAllSlaves() {
  if (!this.slaves || !this.slaves.length) { return []; }

  var living_slaves = this.slaves.filter(function (slave) {
    return ! RedisReplica._isDown("slave", slave);
  });

  var repl = this;
  return living_slaves.map(function connect(slave) {
    return repl.createClient.call(null, slave.port, slave.ip, repl.redisOptions);
  });
};


/**
 * Stringify the replica.
 * @return {String} A descriptive string.
 */
RedisReplica.prototype.toString = function toString() {
  var status_fmt = "%s:%d %s"
    , out_fmt    = "[ RedisReplica %s: Master(%s), Slaves:(%s) ]"
    , master_str = "--:-- DOWN"
    , slaves_str = "";
  
  if (this.master) {
    master_str = util.format(
      status_fmt,
      this.master.ip,
      this.master.port,
      RedisReplica._isDown("master", this.master) ? "DOWN" : "UP"
    );
  }

  if (this.slaves && this.slaves.length) {
    slaves_str = this.slaves
      .map(function (slave) {
        return util.format(
          status_fmt,
          slave.ip,
          slave.port,
          RedisReplica._isDown("slave", slave) ? "DOWN" : "UP"
        );
      })
      .join(", ");
  }

  return util.format(out_fmt, this.name, master_str, slaves_str);
};


module.exports = RedisReplica;
