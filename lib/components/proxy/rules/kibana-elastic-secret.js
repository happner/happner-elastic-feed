function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  if (!facts.req.headers.kibana_server_secret == this.__options.kibana_server_secret) {

    return callback(null, "nomatch");
  }

  return callback();
};

module.exports = Rule;