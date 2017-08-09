var Promise = require('bluebird');

function Worker(){

}

Worker.prototype.initialize = function(options){
  console.log('init worker:::');
  return new Promise(function(resolve){
    resolve();
  });
};


module.exports = Worker;