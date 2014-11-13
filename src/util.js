var node_util = require('util')
  , _         = require('lodash');


// Make a copy of Node's util:
var util    = _.extend({}, node_util);


/**
 * Will try to require something from a parent module.
 * 
 * @param  {String} module_name The name of the module to require. Like the args to a normal require.
 * @return {Object}             The require()-ed module, or null if we couldn't find it at any level.
 */
function parentRequire(module_name) {
  var m = module.parent;

  while ( m ) {
    try {
      return module.require(module_name);
    } catch (ex) {
      m = m.parent;
    }
  }
  return null;
}


/**
 * Will shuffle an array in-place with the Fisher-Yates algorithm.
 * 
 * @param  {Array} arr The array to shuffle
 * @return {Array}     The array, for convenience.
 */
function shuffleArray(arr) {
  var i, rnd, tmp
    , len = arr.length;

  for (i = 0 ; i < len-1; i++) {
    rnd = i + Math.floor(Math.random() * (len - i));
    tmp = arr[i];
    arr[i] = arr[rnd];
    arr[rnd] = tmp;
  }

  return arr;
}


/** 
 * Will dispatch a Redis command that can time out.
 * 
 * @param  {RedisClient} client  The redis client to use.
 * @param  {Number}      timeout The number of milliseconds to wait.
 * @param  {String}      cmd     The command name.
 * @param  {String}      opts    An array of options. Optional.
 * @param  {Function}    cb      Called with (err, results)
 */
function timedCommand(client, timeout, cmd, opts, cb) {
  if (!cb) {
    cb = opts;
    opts = [];
  }

  cb = _.once(cb);

  var timeout_err = new Error("Command timed out");
  var cmd_timeout = setTimeout( cb.bind(null, timeout_err), timeout );

  client.send_command(cmd, opts, function () {
    clearTimeout(cmd_timeout);
    cb.apply(null, arguments);
  });
};


// Now to put our own stuff in there:
util._             = _;
util.async         = require('async');
util.parentRequire = parentRequire;
util.shuffleArray  = shuffleArray;
util.timedCommand  = timedCommand;


module.exports = util;
