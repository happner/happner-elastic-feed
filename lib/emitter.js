var Promise = require('bluebird');
var async = require('async');

function Emitter() {

}

/* initialization, stop and connection to worker */
{

  Emitter.prototype.initialize = function ($happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      _this
        .__connectQueue($happn)
        .then(resolve)
        .catch(reject);
    });
  };

  Emitter.prototype.__connectQueue = function ($happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      if (!$happn.exchange.worker) return reject(new Error('missing worker component'));

      $happn.event.worker.on('emitter', function(job){


      }, function(e){

        if (e) return reject(e);

        resolve(_this);
      });
    });
  };

  Emitter.prototype.stop = function ($happn, callback) {

    callback();
  };
}

module.exports = Emitter;