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

  var cmd_str = util.format("%s %s", cmd, opts.join(" "));
  var timeout_err = new Error("Command timed out: " + cmd_str);
  var cmd_timeout = setTimeout( cb.bind(null, timeout_err), timeout );

  client.send_command(cmd, opts, function () {
    clearTimeout(cmd_timeout);
    cb.apply(null, arguments);
  });
};


var LOGGER_TARGET = null;


/**
 * Will build a simple logger. Will write to stdout IFF we were told to in the user configs.
 * Arguments are the same format as for node util's format function, with the exception that
 * all instances of Error with a 'stack' property are evaluated as that, and as a string
 * otherwise.
 */
function buildLogger(namespace) {
  namespace = String(namespace) + ":";
  enabled = false;

  var out = function _log() {
    if ( ! enabled ) { return; }

    var i, len = arguments.length;
    for (i=0; i<len; i++) {
      var arg = arguments[i];
      if (arg instanceof Error) {
        arguments[i] = (arg.stack) ? arg.stack : String(arg);
      }
    }
    var str = util.format.apply(util, arguments);
    LOGGER_TARGET(namespace, str);
  };

  out.configure = function configure(options) {
    enabled = !! (options.debugLogging);
  };

  return out;
}


// Now to put our own stuff in there:
util._             = _;
util.async         = require('async');
util.parentRequire = parentRequire;
util.shuffleArray  = shuffleArray;
util.timedCommand  = timedCommand;
util.buildLogger   = buildLogger;


// Useful for testing:
util.customLoggerTarget = function (custom_target) {
  if (!custom_target) {
    LOGGER_TARGET = console.log.bind(console);
    return;
  }
  LOGGER_TARGET = custom_target;
};

// Use that custom target thing to set up the initial target:
util.customLoggerTarget(null);


module.exports = util;
