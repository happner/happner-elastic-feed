function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  console.log('kibana->elastic authorize config:::', JSON.stringify(config, null, 2));

  console.log('kibana->elastic authorize facts:::', JSON.stringify({req:{session:facts.req.session, permissions:facts.req.permissions, body:facts.req.body}}, null, 2));

  callback();
};

module.exports = Rule;