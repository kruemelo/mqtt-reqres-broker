// ## brokerSpec
// usage: $ DEBUG=brokerSpec mocha

const debug = require('debug')('mqtt-reqres-broker');
const assert = require('assert');
const MqttReqResBroker = require('../lib/mqtt-reqres-broker.js');
const mqtt = require('mqtt');

const serverOptions = {
  hostname: 'localhost',
  port: 9999
};

const wsBroker = new MqttReqResBroker();

var mqttClientA, mqttClientB;

const clientAId = 'client-a', 
  clientBId = 'client-b';

const clientAChannelId = 'client-a-channel-id';

function pcatch (reason) {
  debug(reason);
  assert(!reason, reason);
}

function startServer (callback) {

  debug('startServer()');

  wsBroker.initialize(serverOptions, err => {
    if (err) {
      console.error(err.stack);
      callback(err);
    }
    else {
      
      wsBroker.start(null, err => {
        if (err) {
          console.error(err.stack);
        } 
        else {
          console.log(`broker running at http://${wsBroker.hostname}:${wsBroker.port}/`);
        }         
        callback(err);
      });
      
    }
  });
}

function connectClient (clientId) {
  return mqtt.connect({ 
      protocol: 'ws',
      host: serverOptions.hostname, 
      port: serverOptions.port,
      clientId: clientId || Math.random().toString(36).substr(2, 23)
    });
}

function onClientConnect (brokerClient) {

  assert.strictEqual(brokerClient.clientId, onClientConnect.mqttClient.clientId);

  setTimeout(() => {
    assert(onClientConnect.mqttClient.connected, 'mqtt client should be connected');
    onClientConnect.callbackFn();
  }, 100);
}

onClientConnect.configure = function (mqttClient, callbackFn) {
  onClientConnect.mqttClient = mqttClient;
  onClientConnect.callbackFn = callbackFn;
};

describe('broker', function () {

  before(done => {

    startServer(err => {
      wsBroker.mqtt.on('client', onClientConnect);
      done();
    });
  });


  after(done => {
    wsBroker.close(done);
  });


  describe('connecting mqtt clients to broker via websockets', () => {

    it('should connect to mqtt client A', done => {
      mqttClientA = connectClient(clientAId);
      onClientConnect.configure(mqttClientA, done);
    });

    it('should connect to mqtt client B', done => {
      mqttClientB = connectClient(clientBId);
      onClientConnect.configure(mqttClientB, done);
    });
  });


  describe('client subscriptions on topic "connect/&lt;device-id&gt;/+"', () => {

    it('should client A subscribe on topic "connect/' + clientAId + '/+"', done => {
      mqttClientA.subscribe(
        `connect/${clientAId}/+`, 
        {qos: 0}, 
        function (err, granted) {
          assert(!err);
          assert.strictEqual(granted[0].qos, 0);
          done();
        }
      );
    });


    it('should client B subscribe on topic "connect/' + clientBId + '/+"', done => {
      mqttClientA.subscribe(
        `connect/${clientBId}/+`, 
        {qos: 0}, 
        function (err, granted) {
          assert(!err);
          assert.strictEqual(granted[0].qos, 0);
          done();
        }
      );
    });


    it('should refuse to subscribe -t connect on invalid topics', done => {

      function promiseTest (topic) {
        return new Promise(function (resolve) {
          mqttClientA.subscribe(
            topic, 
            {qos: 0}, 
            function (err, granted) {
              assert(!err);
              assert(granted[0].qos > 2, 'should not have subscribed -t connect on topic ' + topic);
              resolve();
            }
          );
        });        
      }

      Promise.all(
        [
          // `connect/${clientBId}/+`, 
          `invalid/${clientBId}/+`, 
          `connect`, 
          `connect/`, 
          `connect//`, 
          `connect/+`, 
          `connect/#`, 
          `connect/${clientBId}/#`, 
          `connect/${clientBId}/`, 
          `connect/${clientBId}`, 
          `connect/${clientBId}/+/invalid`,
          `connect/${clientBId}/invalid/+`
        ].map(promiseTest)
      )
      .then(() => done())
      .catch(pcatch);
    });
  });


  describe('connecting client A to client B', () => {

    it('should subscribe -t message/' + clientBId + '/' + clientAChannelId + '/#  ', done => {
      /*
      open a message channel to enable client-a to send messages:
      
      subscribe -t message/&lt;client-b-id&gt;/&lt;client-a-channel-id&gt;/#  
      */
      mqttClientA.subscribe(
        `message/${clientBId}/${clientAChannelId}/#`, 
        {qos: 0}, 
        function (err, granted) {
          assert(!err);
          assert.strictEqual(granted[0].qos, 0);
          done();
        }
      );
    });


    it('should refuse to subscribe -t message on invalid topics', done => {

      function promiseTest (topic) {
        return new Promise(function (resolve) {
          mqttClientA.subscribe(
            topic, 
            {qos: 0}, 
            function (err, granted) {
              assert(!err);
              assert(granted[0].qos > 2, 'should not have subscribed -t message on topic ' + topic);
              resolve();
            }
          );
        });        
      }

      Promise.all(
        [
          // `message/${clientBId}/${clientAChannelId}/#`, 
          `invalid/${clientBId}/${clientAChannelId}/#`, 
          `message`, 
          `message/`, 
          `message//`, 
          `message//+`, 
          `message/#`, 
          `message/${clientBId}/#`, 
          `message/${clientBId}/${clientAChannelId}/+`,
          `message/${clientBId}/${clientAChannelId}/+/bar`,
          `message/${clientBId}/${clientAChannelId}/foo/bar`,
          `message/from-client-id/`, 
          `message/from-client-id`, 
          `message/from-client-id/+`,
          `message/from-client-id/invalid/+`
        ].map(promiseTest)
      )
      .then(() => done())
      .catch(pcatch);
    });


    it(`should publish -t connect/${clientBId}/${clientAId} -m ${clientAChannelId}`, done => {
      /*
      client-a publishes client-a-channel-id as message to client-b:
      
      publish -t connect/&lt;client-b-id&gt;/&lt;client-a-id&gt; -m &lt;client-a-channel-id&gt; 
      */
      mqttClientA.publish(
        // topic
        `connect/${clientBId}/${clientAId}`, 
        // message
        clientAChannelId,
        // options
        {qos: 0}, 
        // callback
        function (err) {
          assert(!err);
          done();
        }
      );
    });
  });


  describe('sending messages between clients', () => {

    /*
    sending messages

    publish -t message/&lt;from&gt;/&lt;to&gt;

    publish -t message/&lt;from-device-id&gt;/&lt;to-channel-id&gt;

    publish -t message/&lt;client-b-id&gt;/&lt;client-a-channel-id&gt;/foo -m '{packetId:123}' 
    */

    it('should enable client B to send messages to client A', done => {

      mqttClientA.on('message', function (topic, payload) {
        if (topic === `message/${clientBId}/${clientAChannelId}/foo`) {
          assert.strictEqual(payload.toString(), 'bar');  
          done();
        }
      });

      mqttClientB.publish(
        // topic
        `message/${clientBId}/${clientAChannelId}/foo`, 
        // message
        'bar',
        // options
        {qos: 0}
      );
    });

  });


  describe('unsubscription of clients', () => {

    it('should unsubscribe client A', done => {

      assert(mqttClientA.connected);

      mqttClientA.end(false, () => {
        
        assert(!mqttClientA.connected);
        
        mqttClientB.end(false, () => {
          done();
        });
      });
    });
  });

});