var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');

function testAnalyzerModule1(){

  this.__events = new EventEmitter();
}

testAnalyzerModule1.prototype.testMethod1 = function(){

  var _this = this;

  //[start:{"key":"testMethod1", "self":"_this"}:start]

  var i = 0;

  while(i < 100000){
    i++;
  }

  //[end:{"key":"testMethod1", "self":"_this"}:end]

};

testAnalyzerModule1.prototype.testMethod2 = function(){

  //[start:{"key":"testMethod2"}:start]

  var i = 0;

  while(i < 100000){
    i++;
  }

  //[end:{"key":"testMethod2"}:end]
};

testAnalyzerModule1.prototype.testMethod3 = function(callback){

  var _this = this;

  //[start:{"key":"testMethod3"}:start]

  setTimeout(function(){
    //[end:{"key":"testMethod3", "self":"_this"}:end]
    callback();
  }, 2000)

};

testAnalyzerModule1.prototype.testPromiseMethod = function(str, int){

  var _this = this;

  //[start:{"key":"testPromiseMethod"}:start]

  return new Promise(function(resolve){

    setTimeout(function(){

      //[end:{"key":"testPromiseMethod", "self":"_this"}:end]
      resolve();
    }, 2000)

  });
};

testAnalyzerModule1.prototype.fireEvent = function(){

  this.emit('some event', {});
};

/* events */
{
  testAnalyzerModule1.prototype.emit = function (key, data, $happn) {

    var _this = this;

    if ($happn) $happn.emit(key, data, function (e) {
      if (e) _this.__events.emit('emit-failure', [key, data]);
    });

    _this.__events.emit(key, data);
  };

  testAnalyzerModule1.prototype.on = function (key, handler) {

    if (key == 'some event')
      //[start:{"key":"some_event"}:start]

    return this.__events.on(key, handler);
  };

  testAnalyzerModule1.prototype.off = function (key, handler) {

    return this.__events.removeListener(key, handler);
  };
}

module.exports = testAnalyzerModule1;