function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  if (facts.req.url == '/_mget'){

    if (!facts.req.body) return callback();

    var body = JSON.parse(facts.req.body);

    if (body.docs && body.docs[0]["_index"] == ".kibana" && body.docs[0]["_type"] == "config") return callback(null, "match");
  }

  return callback();
};

module.exports = Rule;