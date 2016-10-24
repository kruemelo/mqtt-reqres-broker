// run
const debug = require('debug')('broker:run');
const Broker = require('./mqtt-reqres-broker.js');

module.exports = function (options) {
  
  'use strict';

  try {

    debug('process.cwd:', process.cwd());

    const serverOptions = {
      hostname: options.hostname || 'localhost',
      port: options.port || 1883
    };

    const broker = new Broker();

    broker.initialize(serverOptions, err => {
      if (err) {
        console.error(err.stack);
      }
      else {
        broker.start(null, err => {
          if (err) {
            console.error(err.stack);
          } 
          else {
            console.log(`mqtt-reqres-broker running at mqtt://${broker.hostname}:${broker.port}/`);
          }         
        });
        
      }
    });

    return broker;

  } catch (e) {
    console.error(e.stack);
  }
};