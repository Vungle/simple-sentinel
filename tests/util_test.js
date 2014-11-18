var util = require('../src/util')
  , mockRandom = require('./util/mockRandom')
  , fs = require('fs')
  , path = require('path')
  , temp = require('temp').track()
  , expect = require('expect');

describe('Util', function () {
  
  it("extends the Node.js util lib", function () {
    expect(util.format).toBeA(Function);
    expect(util.inherits).toBeA(Function);
  });

  describe("when require()-ing from a parent", function () {

    beforeEach(function () {
      // Blank the util cache reference:
      delete require.cache[require.resolve('../src/util')];
    });

    afterEach(function () {
      // Restore the util cache to a non-temp require chain:
      delete require.cache[require.resolve('../src/util')];
      util = require('../src/util');
    });

    it("gets the right module", function () {

      // This test is tricky. We need to create a temp directory with a sub
      // directory. We then test the ability of one file to use the parent
      // require function with a relative path, and make sure that the path
      // correctly evaluates from the parent directory.
      // 
      // We use sync functions here, because this is a test and I'm not insane. 
      
      var util_dir         = path.join(__dirname, "../src/util");
      var util_dir_escaped = util_dir.replace(/'/g, "\\'");
      var temp_dir         = temp.mkdirSync("sentinel_require_test");
      var temp_subdir      = path.join(temp_dir, "dir");

      var test_start_path = path.join(temp_dir, "run_test.js");

      fs.mkdirSync(temp_subdir);
  
      fs.writeFileSync(test_start_path,                  "module.exports=require('./dir');");
      fs.writeFileSync(path.join(temp_dir, "dep.js"),    "module.exports='root_dir';");
      
      fs.writeFileSync(path.join(temp_subdir, "dep.js"), "module.exports='sub_dir';");
      fs.writeFileSync(path.join(temp_subdir, "index.js"),
        "var util = require('"+util_dir_escaped+"');\n" +
        "module.exports = {\n" +
        "  ours:   require('./dep'),\n" +
        "  parent: util.parentRequire('./dep')\n" +
        "};\n"
      );

      // Require the bottom object, and see what it comes up with:
      var result = require(test_start_path);
      expect(result.ours).toBe("sub_dir");
      expect(result.parent).toBe("root_dir");
    });

    it("gets null on not found", function () {
      // This module BETTER not exist:
      var out = util.parentRequire("fdsjafdsajkfldsjaifodlkfsdjalkf-" + Date.now());
      expect(out).toBe(null);
    });
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
