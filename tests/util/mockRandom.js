var rand = require('random-seed');


// Random tests suck, so we swap out Math.random for a good PRNG with a fixed seed,
// so that we can have all the fun of a random() function with a high period, and
// yet still be consistent and repeatable.


var SAVED_SEED = 382948;

module.exports.installHooks = function () {

  // Swap out Math.random before tests:
  var saved_random = null;
  var rand_engine = null;

  before(function initRNG() {
    rand_engine = rand.create(SAVED_SEED);
  });

  after(function releaseRNG() {
    rand_engine.done();
    rand_engine = null;
  });

  beforeEach(function swapOut() {
    saved_random = Math.random;

    Math.random = function () {
      var out = rand_engine.random();
      return out;
    };
  });

  // Repair it after each test:
  afterEach(function repair() {
    Math.random = saved_random;
    saved_random = null;
  });
};
