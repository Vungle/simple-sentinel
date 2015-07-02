## Changelog

### 0.2.0 (*2015 Jul 2*)
 - Added API to get connection info without connecting.
 - Fixed a minor bug with error handling.

### 0.1.2 (*2014 Dec 14*)
 - Fixed write-to-global bug in the logging logic.
 - Added ability to use custom logging functions.

### 0.1.1 (*2014 Nov 26*)
 - NPM release.
 - Doc updates.
 - Sentinels array is now deduped.
 - Test fixes.

### 0.1.0 (*2014 Nov 18*)
 - Initial release. (Not on NPM though...)
 - Random sentinel connection to a sentinel group.
 - Master / Slave detection for replica sets.
 - Push notifications from sentinel on configuration changes.
 - Up / Down detection for RedisClient connections.
 - Can connect to masters, a random slave, or all slaves simultaneously.
