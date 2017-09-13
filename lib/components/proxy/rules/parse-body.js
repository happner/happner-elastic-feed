var utilities = require('../../../utilities').create();

function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){
  
  utilities.parsePostBody(facts.req, facts.res) // get the body

    .then(function(){
      callback();
    })

    .catch(function(e){
      callback(e);
    })
};

module.exports = Rule;