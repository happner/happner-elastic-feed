var Promise = require('bluebird');

function Source(){

}

Source.prototype.initialize = function(options){

  return new Promise(function(resolve, reject){

    try{
      resolve();
    }catch(e){
      reject(e);
    }
  });
};


module.exports = Source;