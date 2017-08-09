var Promise = require('bluebird');

function Emitter(){

}

Emitter.prototype.attachQueue = function($happn){

  
};

Emitter.prototype.detachQueue = function($happn){

};

Emitter.prototype.initialize = function(options){

  console.log('init:::');

  return new Promise(function(resolve, reject){

    try{
      resolve();
    }catch(e){
      reject(e);
    }
  });
};


module.exports = Emitter;