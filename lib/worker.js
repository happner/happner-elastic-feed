var Promise = require('bluebird')
  , async = require('async')
  ;

function Worker(options) {

  if (!options) throw new Error('worker must be initialized with options argument');

  if (options.jobTypes == null) throw new Error('missing options.jobTypes argument');

  if (!options.queue) options.queue = {};

  if (options) Object.defineProperty(this, '__options', {value: options});
}

Worker.prototype.initialize = function ($happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    async.eachSeries(_this.__options.jobTypes,

      function(jobType, jobTypeCB){


      }, function(e){

        if (e) return reject(e);

        resolve();
      });
  });
};


module.exports = Worker;