var Comedian = require('co-median');
var comedian = new Comedian({cache:1000});

function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  if (!config.settings.method || config.settings.method == facts.req.method){

    if (!config.settings.urls) return callback(null, "match");

    for (var urlIndex in config.settings.urls){

      var url = config.settings.urls[urlIndex];

      var method = url.indexOf(':');

      if (method > -1) {

        method = url.substring(0, method);

        url = url.substring(method.length + 1);

        if (method != facts.req.method) return callback();
      }

      if (comedian.matches(url, facts.req.url)) return callback(null, "match");
    }
  }

  callback();
};

module.exports = Rule;