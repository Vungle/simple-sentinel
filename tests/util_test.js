var util = require('../src/util')
  , mockRandom = require('./util/mockRandom')
  , expect = require('expect');

describe('Util', function () {
  
  it("extends the Node.js util lib", function () {
    expect(util.format).toBeA(Function);
    expect(util.inherits).toBeA(Function);
  });

  describe("when making a logger", function () {
    
    // Swap out the console.log, so we don't get annoying output while testing:
    
    var last_log = null;
    
    beforeEach(function () {
      util.customLoggerTarget(function () {
        last_log = [].slice.call(arguments, 0).join(" ");
      });
    });

    afterEach(function () {
      util.customLoggerTarget(null);
    });


    it("will create a muted log", function () {
      var logger = util.buildLogger("Derp");
      logger("Sup");
      expect(last_log).toBe(null);
    });

    it("can unmute a log", function () {
      var logger = util.buildLogger("Derp");
      logger.configure({debugLogging: true});
      logger("Sup");
      expect(last_log).toBe("Derp: Sup");
    });

    it("will accept formatting stuff", function () {
      var logger = util.buildLogger("Derp");
      logger.configure({debugLogging: true});
      logger("Hello %s!!!%d!", "World", 1);
      expect(last_log).toBe("Derp: Hello World!!!1!");
    });

    describe("with errors", function () {
      it("will show stack traces if available", function () {
        var logger = util.buildLogger("Derp");
        logger.configure({debugLogging: true});
        logger("Error encountered:", new Error("I AM AN ERROR"));
        expect(last_log).toMatch(/^Derp: Error encountered: /);
        expect(last_log).toMatch(/I AM AN ERROR/);
        expect(last_log).toMatch(/util_test\.js/);
      });

      it("will stringify an error if no stack trace", function () {
        var logger = util.buildLogger("Derp");
        var err = new Error("I AM AN ERROR");
        delete err.stack;
        logger.configure({debugLogging: true});
        logger("Error encountered:", err);
        expect(last_log).toMatch(/^Derp: Error encountered: /);
        expect(last_log).toMatch(/I AM AN ERROR/);
      });
    });
  });

  describe("when shuffling an array", function () {

    mockRandom.installHooks();

    it("both edits in place and returns the shuffled array", function () {
      var a = [1,2,3,4,5,6,7,8,9];
      var res = util.shuffleArray(a);
      
      expect(!!a).toBe(true);
      expect(!!res).toBe(true);
      expect(a).toBeAn(Array);
      expect(res).toBeAn(Array);

      for (var idx in a) {
        expect(a[idx]).toBe(res[idx], "Shuffled arrays differ at index " + idx);
      }
    });

    it("gives an ok distribution", function () {
      this.timeout(10000);
      var array;
      var ours = {};
      for(var i=0; i<48000; i++) {
        array = ["1", "2", "3", "4"];
        util.shuffleArray(array);
        var key = array.join("");
        ours[key] = (ours[key] || 0) + 1;
      }

      Object.keys(ours).forEach(function (perm) {
        // Biased solutions cause greater variations in the counts.
        // Good ones will split evenly between the 24 possible permutations,
        // so 2000 each. Bad shuffles will accidentally give some orderings
        // preference, so we use 1700 and 2300 as cutoffs.
        expect(ours[perm]).toBeGreaterThan(1700, "Detected a shuffle bias for: " + perm);
        expect(ours[perm]).toBeLessThan   (2300, "Detected a shuffle bias for: " + perm);
      });
    });
  });
});
