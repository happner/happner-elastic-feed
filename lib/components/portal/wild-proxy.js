var async = require('async')
  , EventEmitter = require('events').EventEmitter
  ;

function WildProxy(options) {

  this.__options = options;

  this.__events = new EventEmitter();

  this.__listeners = [];

  var _this = this;

  this.__options.listeners.forEach (function (listenerConfig) {

    _this.__listeners.push(require('./wild-proxy-listener').create(listenerConfig,  _this.__options.rules));
  });
}

/* create, listen and stop */

WildProxy.create = function(options){

  return new WildProxy(options);
};

WildProxy.prototype.listen = listen;

WildProxy.prototype.stop = stop;

/* events */

WildProxy.prototype.emit = emit;

WildProxy.prototype.on = on;

WildProxy.prototype.off = off;


function emit(key, data, $happn) {

  var _this = this;

  if ($happn) {

    //[start:{"key":"emit", "self":"_this"}:start]

    $happn.emit(key, data, function (e) {

      //[end:{"key":"emit", "self":"_this"}:end]

      if (e) _this.__events.emit('emit-failure', [key, data]);
    });
  }

  _this.__events.emit(key, data);
}

function on(key, handler) {

  return this.__events.on(key, handler);
}

function off(key, handler) {

  return this.__events.removeListener(key, handler);
}

function listen () {

  var _this = this;

  return new Promise(function (resolve, reject) {

    async.eachSeries(_this.__listeners,

    function (listener, listenerCB) {

      listener.listen()

        .then(function(){
          listenerCB();
        })

        .catch(listenerCB);

    }, function (e) {

      if (e) return reject(e);

      resolve();
    });
  });
};

function stop () {

  var _this = this;

  return new Promise(function (resolve, reject) {

    async.eachSeries(_this.__listeners,

      function (listener, listenerCB) {

        listener.stop().then(listenerCB).catch(listenerCB);

      }, function (e) {

        if (e) return reject(e);

        resolve();
      });
  });
};

module.exports = WildProxy;