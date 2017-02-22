
0.11.0 / 2017-02-22
==================

  * Allow overriding default subscribe and send configs
  * Pass message original metadata to subsriber
  * Reconnect on socket close error

0.10.3 / 2017-02-21
==================

  * Fix logging label assignment & colorize output

0.10.2 / 2017-02-21
==================

  * Make default logging less verbouse, use id as label

0.10.1 / 2017-02-21
==================

  * Replace import with require in docs

0.10.0 / 2017-02-21
==================

  * Drop babel in favor of native async/await

0.9.0 / 2016-11-23
==================

  * Upgrade dependencies to actual version
  * Add yarn lock file

0.8.0 / 2016-03-14
==================

  * allow specifying logging transports for more flexible logging

0.7.1 / 2016-02-12
==================

  * better reconnect mechanics that allow for other methods and cancelation

0.7.0 / 2016-02-12
==================

  * try to reconnect to rabbit on fail

0.6.0 / 2016-02-11
==================

  * set queues to be auto-deleted by default

0.5.1 / 2016-02-04
==================

  * better docs

0.5.0 / 2016-02-04
==================

  * add way to manually ack/nack messages

0.4.0 / 2016-02-03
==================

  * allow unsubscribing single consumers using consumerTag
  * add subscribers info plugin
  * add healthcheck plugin
  * generate unique id for each instance

0.3.0 / 2016-02-03
==================

  * add basic plugin support and hardware stats plugin

0.2.0 / 2016-02-03
==================

  * make unsubscribe leave queue, add test for it
  * document code, remove unnecessary addWorker method
  * unify master and runner into one class

0.1.0 / 2016-02-03
==================
  * initial version
