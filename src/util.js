var node_util = require('util')
  , _         = require('lodash');


// Make a copy of Node's util:
var util    = _.extend({}, node_util);


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


// Now to put our own stuff in there:
util._             = _;
util.step          = require('step');
util.parentRequire = parentRequire;
util.redis


module.exports = util;
