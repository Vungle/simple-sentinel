simple-sentinel
===============

An easy-to-use redis-sentinel client for Node.js.

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
  // Omit this to track everything that the chosen sentinel knows about:
  watchedReplicaNames: ["replica_a", "replica_b", "replica_d"]
};

// Create a sentinel object to track the given Replicas:
var sentinel = new RedisSentinel(sentinels, options);

// Keep track of the Masters here:
var masters = {
  replica_a: null,
  replica_b: null,
  replica_d: null
};

// Listen for connection info to become ready:
sentinel.on('ready', function (name, replica) {
  console.log("Just got connection info for Replica:", name);
  masters[name] = replica.connectMaster();
});
```

### API

#### RedisSentinel

This represents a connection to a cluster of redis-sentinels. It is also an EventEmitter, and will notify you in the case of state-changes, or problems.

##### Constructor: (sentinels, config)

Will create the structure, and start the process of connecting. This object is an EventEmitter, and so events will be emitted when connections are done, and connections are available.

`sentinels` is an Array of objects, each with connection info to a single redis-sentinel. These objects should contain:
- `host` is the hostname to connect to.
- `port` is the port to connect to. Default: 26379.

`config` is an optional object used to store other configuration details. If omitted (or otherwise falsey) then only default values will be used. This object can contain:
- `watchedReplicaNames` is an Array of the String names of Replicas to watch. Default is to watch everything that a sentinel is currently watching.

##### Function: getRepl(name)

Takes the string name of a Replica, and will return a `RedisReplica` object (see below). Will return `null` if we are not tracking that Replica.

##### Function: getWatchedReplicaNames()

Will return an array of strings representing the replicas that this `RedisSentinel` object is watching.

##### Event: "error"

Emitted when there was an internal error, or if all redis-sentinels are down.

Has arguments: `(error)`
- `error` is an Error object. Big surprise. :)

##### Event: "change"

Emitted when the connection information around a Replica has changed.

Has arguments: `(name, replica)`
- `name` is the String name of a watched Replica
- `replica` is an instance of `RedisReplica` (see below).

##### Event: "event"

Emitted when an important event has happened. This is mostly useful for logging.

Has arguments: `(replica_name, event_type, event_message`
- `replica_name` is a String that represents the replica that experienced the event, or `null` if the redis-sentinel itself had an issue.
- `event_type` is a short String that describes the event type.
- `event_message` is a short String describing what happened.

#### RedisReplica

This object stores the connection information to all object in a Replica Set, and gives you a bunch of useful methods for connecting to them with [node-redis](https://github.com/mranney/node_redis)

##### Function: connectMaster()

Will create a connection to the master server in the Replica Set. Returns a brand-new `RedisClient`. Will be `null` if there is no way to currently connect to the master.

##### Function: connectSlave()

Will create a connection to a random slave in the Replica Set. Returns a brand-new `RedisClient`. Will be `null` if no slaves are currently available.

##### Function connectAllSlaves()

Will create connections to all slaves in a Replica Set. Returns an Array of brand-new `RedisClient`s.
Useful if you want to implement any round-robin load balancing, or what-have-you. This Array will be empty if no slaves are currently connectable.
