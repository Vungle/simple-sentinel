var RedisConfigFetcher = require('../src/redisConfigFetcher')
  , util               = require('../src/util')
  , EventEmitter       = require('events').EventEmitter
  , expect             = require('expect');


function FakeClient() {

}

util.inherits(FakeClient, EventEmitter);


describe("RedisConfigFetcher", function () {
  describe("during initialization", function () {
    it("emits 'error' on connection error", function (done) {
      var client = new FakeClient();
      var rcf = new RedisConfigFetcher('localhost', 6379, {
        _testClient: client,

      });
    });
    it("emits 'error' on client close");
    it("emits 'error' on timeout");
    it("emits 'error' with non-sentinel");
    it("emits 'connected' with sentinel");
  });

  describe("when using isInfoResponseValid", function () {
    
    it("detects null as non-sentinel", function () {
      var res = RedisConfigFetcher._isInfoResponseValid(null);
      expect(res).toBe(false);
    });

    it("detects a normal info as non-sentinel", function () {
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
      var res = RedisConfigFetcher._isInfoResponseValid(normal_info);
      expect(res).toBe(false);
    });

    it("detects a sentinel info as such", function () {
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
      var res = RedisConfigFetcher._isInfoResponseValid(sentinel_info);
      expect(res).toBe(true);
    });
  });

  describe("when parsing a server list", function () {
    it("rejects bad types");
    it("rejects odd number of items in list");
    it("rejects dupe properties");
    it("rejects non-numeric ports");
    it("rejects missing name");
    it("parses flags as array");
    it("parses multiple rows");
  });

  describe("when building a lookup", function () {
    it("fails on non-arrays");
    it("fails when something lacks a name");
    it("fails with duplicate names");
    it("works when everything is ok");
  });

  describe("when updating configs", function () {
    it("emits 'error' when timeout");
    it("emits 'error' when bad results from masters command");
    it("emits 'error' when bad results from slaves command");
    it("emits 'config' with correct values");
    it("runs one update at a time");
  });
});
