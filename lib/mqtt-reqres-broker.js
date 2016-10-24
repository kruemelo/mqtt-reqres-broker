// ## MqttReqResBroker


module.exports = function () {

  'use strict';

  // dependencies
  const debug = require('debug')('mqtt-reqres-broker');
  const aedes = require('aedes');
  const http = require('http');
  const ws = require('websocket-stream');

  const noop = function () {};

  // limit the maximum payload size
  const MAX_PAYLOAD_LENGTH = 1024 * 512;

  // ## broker class
  class MqttReqResBroker {

    // ### constructor
    constructor () {

      // debug('constructor()');

      this.hostname = null;
      this.port = null;
      this.mqtt = null;
      this.httpServer = null;
      this.wss = null;
    } // ctor

    // ### initialize(options, callback)
    initialize (options, callback) {

      debug('initialize', options);

      this.hostname = options.hostname;
      this.port = options.port;

      if (this.mqtt) {
        this.mqtt.close();
      }

      // for options see: https://github.com/mcollina/aedes#aedesopts
      this.mqtt = aedes();

      /*  authorizeSubscribe
          It will be called when a client publishes a message. 
          see: https://github.com/mcollina/aedes#instanceauthorizesubscribeclient-pattern-doneerr-pattern
      */    
      this.mqtt.authorizeSubscribe = function (client, sub, cb) {

        debug('%s authorizeSubscribe(%s, %s)', client.id, client.id, sub.topic);

        try {

          if (sub.topic.length > 500) {
            throw new Error('ESUBTOPIC');
          }

          const topicParts = sub.topic.split('/');

          if (sub.qos !== 0) {
            throw new Error('ESUBQOS');
          }

          if (topicParts[0] === 'connect') {
            if (topicParts[1] && topicParts[2] === '+' && topicParts.length === 3) {
              // subscribe -t connect/&lt;device-id&gt;/+
              debug('%s authorizeSubscribe() subscribed connect/%s/+', client.id, topicParts[1]);
            }
            else {
              throw(new Error('ESUBCONNECT'));
            }
          }
          else if (topicParts[0] === 'message') {
            if (topicParts[1] && topicParts[2] && topicParts[3] === '#' && topicParts.length === 4) {
              // subscribe -t message/&lt;from-client-id&gt;/&lt;to-channel-id&gt;/#
              debug('%s authorizeSubscribe() subscribed message/%s/%s/#', client.id, topicParts[1], topicParts[2]);
            }
            else {
              throw(new Error('ESUBMESSAGE'));
            }       
          }
          else {
            throw(new Error('ESUBTOPIC'));
          }
        }
        catch (error) {
          // To negate a subscription, set the subscription to null
          sub = null;
          debug('%s authorizeSubscribe() error:', client.id, error);
        }

        cb(null, sub);
      };


      /*  authorizePublish
          It will be called when a client publishes a message.
          see: https://github.com/mcollina/aedes#instanceauthorizesubscribeclient-pattern-doneerr-pattern
      */
      this.mqtt.authorizePublish = function (client, packet, cb) {

        debug('%s authorizePublish(%s, %s)', client.id, client.id, packet.topic);

        var error = null;

        try {

          if (packet.topic.length > 500) {
            throw new Error('EPUBTOPIC');
          }

          if (packet.payload.length > MAX_PAYLOAD_LENGTH) {
            throw new Error('EPUBPAYLOAD');
          }

          const topicParts = packet.topic.split('/');

          if (packet.qos !== 0) {
            throw new Error('EPUBQOS');
          }

          if (packet.retain) {
            throw new Error('EPUBRETAIN');
          }

          if (topicParts[0] === 'connect') {
            if (topicParts[1] && topicParts[2] && topicParts.length === 3) {
              // publish -t connect/&lt;to-device-id&gt;/&lt;from-client-id&gt;
              debug('%s authorizePublish() published connect/%s/%s', client.id, topicParts[1], topicParts[2]);
            }
            else {
              throw(new Error('EPUBCONNECT'));
            }
          }
          else if (topicParts[0] === 'message') {
            if (topicParts[1] && topicParts[2] && topicParts.length >= 3) {
              // publish -t message/&lt;from-client-id&gt;/&lt;to-channel-id&gt;
              debug('%s authorizePublish() published message/%s/%s', client.id, topicParts[1], topicParts[2]);
            }
            else {
              throw(new Error('EPUBMESSAGE'));
            }       
          }
          else {
            throw(new Error('EPUBTOPIC'));
          }

        }
        catch (e) {
          error = e;
          debug('%s authorizePublish() error:', client.id, error);
        }

        cb(error);
      };


      // initialize done
      callback();

      return this;
    } // initialize


    // ### initializeMQTTEventHandlers (options, callback) 
    initializeMQTTEventHandlers (options, callback) {

      debug('initializeMQTTEventHandlers()');

      const mqtt = this.mqtt;

      // for event descriptions see https://github.com/mcollina/aedes#aedesopts

      mqtt.on('subscribe', (topics, client) => {

        if (client) {

          debug(
            '%s on subscribe topics', 
            client.id
          );

          topics.forEach(topic => {
            debug(
              '%s topic "%s" qos: %s', 
              topic.topic,
              topic.qos,
              client.id
            );
          });
        }
      });


      mqtt.on('publish', function (packet, client) {

        if (client) {

          debug(
            '%s on publish message %s topic "%s" qos %s', 
            client.id, 
            packet.topic,
            packet.qos
            // packet.payload.toString()
          );
        }
      });


      mqtt.on('clientError', function (client, err) {
        debug('%s client error', client.id, err.message, err.stack);
      });


      mqtt.on('client', function (client) {
        debug('%s on client -  a new Client connects', client.id);
      });


      callback();

      return this;
    } // initializeMQTTEventHandlers


    // ### start (options, callback) 
    start (options, callback) {

      debug('start()');

      this.httpServer = http.createServer();

      this.wss = ws.createServer({
        server: this.httpServer
      }, this.mqtt.handle);

      // init mqtt event handlers
      this.initializeMQTTEventHandlers(null, () => {

        // app.listen(port, [hostname], [backlog], [callback])
        this.httpServer.listen(this.port, this.hostname, callback);
      });

      return this;
    } // start


    // ###close (callback) 
    close (callback) {

      callback = callback || noop;

      if (this.mqtt) {
        this.mqtt.close();
      }

      if (this.wss) {
        this.wss.close();
      }

      if (this.httpServer) {
        // this.httpServer.unref();
        // Stops the server from accepting new connections and keeps existing connections. This function is asynchronous, the server is finally closed when all connections are ended and the server emits a 'close' event. The optional callback will be called once the 'close' event occurs. Unlike that event, it will be called with an Error as its only argument if the server was not open when it was closed.
        // see: https://nodejs.org/dist/latest-v6.x/docs/api/net.html#net_server_close_callback
        this.httpServer.close(callback);
      }
      else {
        callback();
      } 

      return this;
    } // close

  } // MqttReqResBroker

  return MqttReqResBroker;

}();