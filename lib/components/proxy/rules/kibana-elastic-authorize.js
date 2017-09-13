function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  console.log('in authorize:::', facts.req.url, facts.req.body);
  
  callback();
};

module.exports = Rule;