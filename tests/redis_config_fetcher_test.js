var RedisConfigFetcher = require('../src/redisConfigFetcher')
  , util               = require('../src/util')
  , EventEmitter       = require('events').EventEmitter
  , expect             = require('expect');


function FakeClient() {
  this.send_command = function () {};
  this.end = function () {};
}
util.inherits(FakeClient, EventEmitter);


var normal_info
  = "# Server\r\nredis_version:2.8.11\r\nredis_git_sha1:00000000\r\nredis_git_dirty:0"
  + "\r\nredis_build_id:cd43e547b41f72f\r\nredis_mode:standalone\r\nos:Darwin 13.4.0 "
  + "x86_64\r\narch_bits:64\r\nmultiplexing_api:kqueue\r\ngcc_version:4.2.1\r\nproces"
  + "s_id:56422\r\nrun_id:8c786b8dd9e86ff83d360ac0c34a7632afbbff66\r\ntcp_port:6379\r"
  + "\nuptime_in_seconds:25781\r\nuptime_in_days:0\r\nhz:10\r\nlru_clock:6747792\r\nc"
  + "onfig_file:/usr/local/etc/redis.conf\r\n\r\n# Clients\r\nconnected_clients:9\r\n"
  + "client_longest_output_list:0\r\nclient_biggest_input_buf:0\r\nblocked_clients:0"
  + "\r\n\r\n# Memory\r\nused_memory:1145552\r\nused_memory_human:1.09M\r\nused_memory"
  + "_rss:2015232\r\nused_memory_peak:1499792\r\nused_memory_peak_human:1.43M\r\nused"
  + "_memory_lua:33792\r\nmem_fragmentation_ratio:1.76\r\nmem_allocator:libc\r\n\r\n#"
  + " Persistence\r\nloading:0\r\nrdb_changes_since_last_save:0\r\nrdb_bgsave_in_prog"
  + " ress:0\r\nrdb_last_save_time:1416014109\r\nrdb_last_bgsave_status:ok\r\nrdb_last"
  + "_bgsave_time_sec:0\r\nrdb_current_bgsave_time_sec:-1\r\naof_enabled:0\r\naof_rew"
  + "rite_in_progress:0\r\naof_rewrite_scheduled:0\r\naof_last_rewrite_time_sec:-1\r"
  + "\naof_current_rewrite_time_sec:-1\r\naof_last_bgrewrite_status:ok\r\naof_last_wri"
  + "te_status:ok\r\n\r\n# Stats\r\ntotal_connections_received:33\r\ntotal_commands_p"
  + "rocessed:343\r\ninstantaneous_ops_per_sec:0\r\nrejected_connections:0\r\nsync_fu"
  + "ll:0\r\nsync_partial_ok:0\r\nsync_partial_err:0\r\nexpired_keys:0\r\nevicted_key"
  + "s:0\r\nkeyspace_hits:41\r\nkeyspace_misses:126\r\npubsub_channels:0\r\npubsub_pa"
  + "tterns:0\r\nlatest_fork_usec:233\r\n\r\n# Replication\r\nrole:master\r\nconnecte"
  + "d_slaves:0\r\nmaster_repl_offset:0\r\nrepl_backlog_active:0\r\nrepl_backlog_size"
  + ":1048576\r\nrepl_backlog_first_byte_offset:0\r\nrepl_backlog_histlen:0\r\n\r\n# "
  + "CPU\r\nused_cpu_sys:1.21\r\nused_cpu_user:1.15\r\nused_cpu_sys_children:0.00\r\n"
  + "used_cpu_user_children:0.00\r\n\r\n# Keyspace\r\ndb0:keys=1,expires=0,avg_ttl=0"
  + "\r\ndb1:keys=11,expires=5,avg_ttl=101643976\r\ndb3:keys=3,expires=0,avg_ttl=0\r"
  + "\ndb4:keys=7,expires=3,avg_ttl=926438415\r\ndb9:keys=1,expires=1,avg_ttl=665737"
  + "58";

var sentinel_info
  = "# Server\r\nredis_version:2.8.11\r\nredis_git_sha1:00000000\r\nredis_git_dirty:0"
  + "\r\nredis_build_id:cd43e547b41f72f\r\nredis_mode:sentinel\r\nos:Darwin 13.4.0 x8"
  + "6_64\r\narch_bits:64\r\nmultiplexing_api:kqueue\r\ngcc_version:4.2.1\r\nprocess_"
  + "id:48377\r\nrun_id:8397fda691ee9289b623c3904e21301ac4ef82ae\r\ntcp_port:9501\r\n"
  + "uptime_in_seconds:116301\r\nuptime_in_days:1\r\nhz:16\r\nlru_clock:6748294\r\nco"
  + "nfig_file:/Users/lolusername/sentinel-test/a/sentinel.conf\r\n\r\n# Sentinel\r\n"
  + "sentinel_masters:3\r\nsentinel_tilt:0\r\nsentinel_running_scripts:0\r\nsentinel_"
  + "scripts_queue_length:0\r\nmaster0:name=cache,status=ok,address=127.0.0.1:9203,sl"
  + "aves=2,sentinels=5\r\nmaster1:name=main,status=ok,address=127.0.0.1:9001,slaves="
  + "1,sentinels=5\r\nmaster2:name=shard,status=ok,address=127.0.0.1:9102,slaves=1,se"
  + "ntinels=5";


describe("RedisConfigFetcher", function () {
  describe("during initialization", function () {
    it("emits 'error' on connection error", function (done) {
      var client = new FakeClient();
      var rcf = new RedisConfigFetcher('localhost', 6379, {
        _testClient: client
      });
      rcf.on('error', function (err) {
        expect(err.message).toMatch(/lol test/i);
        done();
      })
      client.emit('error', new Error("LOL TEST"));
    });

    it("emits 'error' on client close", function (done) {
      var client = new FakeClient();
      var rcf = new RedisConfigFetcher('localhost', 6379, {
        _testClient: client
      });
      rcf.on('error', function (err) {
        done();
      })
      client.emit('end');
    });

    it("emits 'error' on command timeouts", function (done) {
      this.timeout(1000);

      var client = new FakeClient();
      var rcf = new RedisConfigFetcher('localhost', 6379, {
        _testClient: client,
        commandTimeout: 50
      });
      rcf.on('error', function (err) {
        expect(err.message).toMatch(/timed out/i);
        done();
      });
      client.emit('ready');
    });

    it("emits 'error' with non-sentinel", function (done) {
      var client = new FakeClient();
      client.send_command = function (cmd, args, cb) {
        expect(cmd).toBe("INFO");
        cb(null, normal_info);
      };

      var rcf = new RedisConfigFetcher('localhost', 6379, {
        _testClient: client,
        commandTimeout: 50
      });

      rcf.on('error', function (err) {
        expect(err.message).toMatch(/invalid response/i);
        done();
      });
      client.emit('ready');
    });

    it("emits 'connected' with sentinel", function (done) {
      var client = new FakeClient();
      client.send_command = function (cmd, args, cb) {
        expect(cmd).toBe("INFO");
        cb(null, sentinel_info);
      };

      var rcf = new RedisConfigFetcher('localhost', 6379, {
        _testClient: client,
        commandTimeout: 50
      });
      
      rcf.on('connected', done);
      client.emit('ready');
    });
  });

  describe("when using isInfoResponseValid", function () {
    
    it("detects null as non-sentinel", function () {
      var res = RedisConfigFetcher._isInfoResponseValid(null);
      expect(res).toBe(false);
    });

    it("detects a normal info as non-sentinel", function () {
      var res = RedisConfigFetcher._isInfoResponseValid(normal_info);
      expect(res).toBe(false);
    });

    it("detects a sentinel info as such", function () {
      var res = RedisConfigFetcher._isInfoResponseValid(sentinel_info);
      expect(res).toBe(true);
    });
  });

  describe("when parsing a server list", function () {
    
    var rcf = new RedisConfigFetcher("localhost", 6379, { _testClient: new FakeClient() });
    rcf._log = function () {
      last_log = [].slice.call(arguments, 0).join(" ");
    }

    var last_log = null;
    beforeEach(function () {
      last_log = null;
    });

    it("rejects bad types", function () {
      var res = rcf._parseServerList("Master", null);
      expect(res).toBe(null);
      expect(last_log).toBe("Master list rejected: Bad input");
    });

    it("rejects odd number of items in list", function () {
      var res = rcf._parseServerList("Master", [["name", "derp", "foobar"]]);
      expect(res).toBe(null);
      expect(last_log).toBe("Master list rejected: Malformed row");
    });

    it("rejects dupe properties", function () {
      var res = rcf._parseServerList("Master", [["name", "derp", "hello", "world", "name", "not derp"]]);
      expect(res).toBe(null);
      expect(last_log).toBe("Master list rejected: Row had duplicate property");
    });

    it("rejects non-numeric ports", function () {
      var res = rcf._parseServerList("Master", [["name", "derp", "port", "foobar", "thing", "blahblah"]]);
      expect(res).toBe(null);
      expect(last_log).toBe("Master list rejected: Row has a non-numeric port");
    });

    it("rejects missing name", function () {
      var res = rcf._parseServerList("Master", [["port", "1234", "thing", "blahblah"]]);
      expect(res).toBe(null);
      expect(last_log).toBe("Master list rejected: Row lacked a name property");
    });

    it("parses ports as numbers", function () {
      var res = rcf._parseServerList("Master", [["name", "derp", "port", "1234", "thing", "blahblah"]]);
      expect(!!res).toBe(true);
      expect(res[0].port).toBe(1234);
      expect(last_log).toBe(null);
    });

    it("parses flags as array", function () {
      var res = rcf._parseServerList("Master", [["name", "derp", "flags", "master,s_down,o_down", "thing", "blahblah"]]);
      expect(!!res).toBe(true);
      expect(res[0].flags).toBeAn(Array);
      expect(res[0].flags).toContain("master");
      expect(res[0].flags).toContain("s_down");
      expect(res[0].flags).toContain("o_down");
      expect(last_log).toBe(null);
    });

    it("parses multiple rows", function () {
      var res = rcf._parseServerList("Master", [
        ["name", "herp", "ip", "127.0.0.1", "flags", "master,s_down,o_down"],
        ["name", "derp", "ip", "127.0.0.2", "flags", "master"]
      ]);
      expect(!!res).toBe(true);
      expect(res[0].name).toBe("herp");
      expect(res[1].name).toBe("derp");
      expect(res[0].ip).toBe("127.0.0.1");
      expect(res[1].ip).toBe("127.0.0.2");
      expect(res[0].flags).toBeAn(Array);
      expect(res[1].flags).toBeAn(Array);
      expect(res[0].flags).toContain("master");
      expect(res[0].flags).toContain("s_down");
      expect(res[0].flags).toContain("o_down");
      expect(res[1].flags).toContain("master");
      expect(last_log).toBe(null);
    });
  });

  describe("when building a lookup", function () {

    var rcf = new RedisConfigFetcher("localhost", 6379, { _testClient: new FakeClient() });
    rcf._log = function () {
      last_log = [].slice.call(arguments, 0).join(" ");
    }

    var last_log = null;
    beforeEach(function () {
      last_log = null;
    });

    it("passes nulls along without logging", function () {
      var res = rcf._buildLookup(null);
      expect(res).toBe(null);
      expect(last_log).toBe(null);
    });

    it("fails on non-arrays", function () {
      var res = rcf._buildLookup({a: "lol"});
      expect(res).toBe(null);
      expect(last_log).toBe("Failed to build lookup: Non-array provided");
    });

    it("fails when something lacks a name", function () {
      var res = rcf._buildLookup([{a: "lol"}]);
      expect(res).toBe(null);
      expect(last_log).toBe("Failed to build lookup: Item # 0 has no name");
    });

    it("fails with duplicate names", function () {
      var res = rcf._buildLookup([{name: "lol"}, {name: "derp"}, {name: "lol"}]);
      expect(res).toBe(null);
      expect(last_log).toBe("Failed to build lookup: Duplicate name in array: lol");
    });

    it("works when everything is ok", function () {
      var res = rcf._buildLookup([{name: "lol", ip: "123.45.67.89"}, {name: "derp", ip: "98.76.54.32"}]);
      expect(!!res).toBe(true);
      expect(res).toBeAn(Object);
      expect(!!res.lol).toBe(true);
      expect(!!res.derp).toBe(true);
      expect(res.lol.ip).toBe("123.45.67.89");
      expect(res.derp.ip).toBe("98.76.54.32");
      expect(last_log).toBe(null);
    });
  });

  describe("when updating configs", function () {
    it("emits 'error' when timeout");
    it("emits 'error' when bad results from masters command");
    it("emits 'error' when bad results from slaves command");
    it("emits 'config' with correct values");
    it("runs one update at a time");
  });
});
