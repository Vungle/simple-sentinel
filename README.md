simple-sentinel [![Build Status](https://travis-ci.org/Vungle/simple-sentinel.svg?branch=master)](https://travis-ci.org/Vungle/simple-sentinel)
===============

A stable, and easy to use redis-sentinel client for Node.js. Features include:

 - Simple, event-based API.
 - Randomized connections to sentinels, and automatic reconnection on sentinel failure.
 - Uses Sentinel's Pub/Sub commands for real-time config updates during failovers.
 - Uses Sentinel info to help dodge outages.

### Installing

```sh
npm install --save simple-sentinel
```

### Sample Code

```javascript
// Put all sentinel servers in here. A random one will be used:
var sentinels = [
  { host: '10.2.3.41', port: 26379 },
  { host: '10.2.3.42', port: 26379 },
  { host: '10.2.3.43', port: 26379 },
  { host: '10.2.3.44', port: 26379 },
  { host: '10.2.3.45', port: 26379 }
];

var options = {
  // Omit this to track all servers that the sentinel knows about:
  watchedNames: ["replica_a", "replica_b", "replica_d"]
};

// Create a sentinel object to track the given Replicas:
var sentinel = new RedisSentinel(sentinels, options);

// Keep track of the Masters here:
var masters = {
  replica_a: null,
  replica_b: null,
  replica_d: null
};

// Listen for connection info changes:
sentinel.on('change', function (name, replica) {
  console.log("Just got connection info for Replica:", name, replica.toString());
  masters[name] = replica.connectMaster();
});
```

### API

#### RedisSentinel

This object is used to connect to a redis-sentinel cluster. It is an EventEmitter, and will notify you about outages or failovers as they happen.

##### Constructor: (sentinels, config)

Will open the connection to one of the sentinels in the 'sentinels' array.

- `sentinels` is an Array of objects, each with connection info for a single redis-sentinel. These objects should contain:
    - `host` (**String**) is the hostname to connect to.
    - `port` (**Number**) is the port to connect to. Default: 26379.

- `config` is an optional object used to store other configuration details. If omitted (or otherwise falsey) then only default values will be used. This object can contain:
    - `commandTimeout` (**Number**) is the maximum number of milliseconds that we'll wait for a command on this sentinel to return. Default is 1500.
    - `createClient` (**Function**) is the function that will create the `RedisClient`s that are returned to you. By default, this library will try to require() the [node-redis](https://github.com/mranney/node_redis) library from the scope of your project automagically, and use our own version if yours is unavailable. If you want to do something more advanced, then you can use this argument to override the default. The function will be called with the arguments: `(port, host, options)`.
    - `customLogger` (**Function**) is the function used when logging messages. This function will only be called if `debugLogging` is set to true. Is called with a single string argument: `(message)`. Default: `console.log`.
    - `debugLogging` (**Boolean**) should be true if you want to see the noisy debug log. Default is `false`.
    - `outageRetryTimeout` (**Number**) is the number of milliseconds before trying again if ALL sentinels are down. If this number is negative, then we will simply emit an error instead of retrying. Default is 5000.
    - `randomizeSentinels` (**Boolean**) indicates whether the sentinels list should be shuffled before attempting connections. Default is true.
    - `redisOptions` (**Object**) is the object that is passed to createClient as options. Default is `{}`.
    - `refreshTimeout` (**Number**) is the number of milliseconds between attempts to fetch configurations from redis. Normally, we use events emitted to us through sentinel's pub/sub mechanism, but we always have this as a fallback should a message not make it to us. Default is 60000.
    - `timeout` (**Number**) is the connect timeout in milliseconds for connecting to a sentinel server. Default is 500.
    - `watchedNames` (**Array**) is an Array of the String names of Replicas to watch. Default is to watch everything that a sentinel is currently watching.

##### Event: "error"

Emitted when there was an internal error, or if all redis-sentinels are down and retries have been disabled.

Has arguments: `(error)`
- `error` is an Error object. Big surprise. :)

##### Event: "change"

Emitted when the connection information around a Replica has changed. This will also be emitted during the initial startup, when we get the Replica configurations for the first time. Use this to get information on the Replicas that you're keeping track of.

Has arguments: `(name, replica)`
- `name` (**String**) is name of a watched Replica.
- `replica` (**RedisReplica**) is the `RedisReplica` for the given name (see below).

##### Event: "event"

Emitted when an important event has happened. These are simply events that were passed to us through pub/sub in sentinel. Don't rely on these: some events may be omitted or duplicated in certain cases (such as when switching from one sentinel to another.) This is mostly useful for logging.

Has arguments: `(event_type, event_message)`
- `event_type` (**String**) is the event type, like `"+odown"`.
- `event_message` (**String**) describes what happened, like `"master main 127.0.0.1 9001 #quorum 4/3"`.


#### RedisReplica

This object stores the connection information to all object in a Replica Set, and gives you a bunch of useful methods for connecting to them with [node-redis](https://github.com/mranney/node_redis). It is provided in the `change` events.

##### Function: connectMaster()

Will create a connection to the master server in the Replica Set. Returns a brand-new `RedisClient`. Will be `null` if the server is currently objectively down, and there is no way to connect to it. (Uh-oh.)

##### Function: connectSlave()

Will create a connection to a random available slave in the Replica Set. A slave is unavailable if the Sentinel describes this server as being subjectively down. Returns a brand-new `RedisClient`. Will be `null` if no slaves are currently available.

##### Function connectAllSlaves()

Will create connections to all available slaves in a Replica Set. A slave is unavailable if the Sentinel describes this server as being subjectively down. Returns an Array of brand-new `RedisClient`s. Useful if you want to implement any round-robin load balancing, or what-have-you. This Array will be empty if no slaves are currently connectable.

##### Function: getMasterConfig()

Will fetch the connection information for the current master in the Replica Set. If the master is available, then returns an Object with the keys:
- `host` (**String**) is the hostname of the master. Should usually be an IP address.
- `port` (**Number**) is the port to connect to.

Returns `null` when master is unavailable.

##### Function: getSlaveConfig()

Will fetch the connection information for a random slave in the Replica Set. If a slave is available, then returns an Object with the keys:
- `host` (**String**) is the hostname of the slave. Should usually be an IP address.
- `port` (**Number**) is the port to connect to.

Returns `null` when all slaves are down.

##### Function: getAllSlaveConfigs()

Will fetch the connection information for all available slaves in the Replica Set. Returns an array of Objects, where each object has keys:
- `host` (**String**) is the hostname of the slave. Should usually be an IP address.
- `port` (**Number**) is the port to connect to.

### License

MIT
