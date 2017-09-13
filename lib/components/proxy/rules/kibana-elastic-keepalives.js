function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  console.log('in keep alives:::', facts.req.url, facts.req.headers, facts.req.method);

  if (facts.req.url == '/' && facts.req.headers['content-length'] == 0 && facts.req.method == "HEAD") return callback(null, "match");

  callback();
};

module.exports = Rule;