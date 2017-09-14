function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  if ((!config.settings.method || config.settings.method == facts.req.method) &&
      (!config.settings.urls || config.settings.urls.indexOf(facts.req.url) > -1)) return callback(null, "match");

  callback();
};

module.exports = Rule;