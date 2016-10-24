# mqtt-reqres-broker

mqtt request/response broker based on [aedes](https://github.com/mcollina/aedes)


## start mqtt reqres websocket broker

```
// production
$ npm start

// starts with debug 
$ npm run start:debug
```

make sure `broker` file is executable:


```
$ chmod u+x index.js
``` 

### start options

```
$ npm start -- -h localhost -p 1883

// or

$ ./broker start -h 0.0.0.0 -p 1883

// or debug

$npm run start:debug
```

## stop

press `Ctrl` + `c`

```
$ ./broker start
^C
$ 
```

## test

runs mocha specs in /test

```
$ npm test

// or

$ npm run test:debug
```

see all npm tasks defined in [package.json](./package.html).

# API


```
var MqttReqResBroker = require('mqtt-reqres-broker');
```

## Methods

### MqttReqResBroker()
constructor

### initialize(options, callback)

send a request to an other client.

**options**:
- hostname string optional default 'localhost'
- port number optional default 1883

**callback**
callback function called when initialization done. only arg is "err".

**returns** instance of MqttReqResBroker

### start(options, callback)

**options** null required; currently takes no options


**callback** function required; callback 


### close(callback) 

closes the broker websocket and http servers.


## Example

```
var broker = new MqttReqResBroker()

broker.initialize(
  {
    hostname: '127.0.0.1',
    port: 9999
  }, function (err) {

    broker.start(null, function (err) {
      // ..  

    });
  }
);
```

## Build docs

create annotated source documentation in `doc/` folder, uses [groc](https://github.com/nevir/groc)

```
$ npm run build:docs
```
