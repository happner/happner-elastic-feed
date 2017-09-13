var utilities = require('../../../utilities');

function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  var _this = this;

  if (!facts.req.session) return callback(null, "nomatch");

  if (_this.__permissionsCache.get(facts.req.session.id) == null)

  //the session cache has either dumped the session or we have restarted the proxy between authorization and authentication requests
  //TODO: think about replays here!!!
    return _this.__setPermissions(facts.req.session, _this.$happn, function(e){

      if (e) return callback(e);

      facts.req.permissions = _this.__permissions.search({path:'*', filter:{key:session.id}});

      callback();
    });

  facts.req.permissions = _this.__permissions.search({path:'*', filter:{key:session.id}});

  callback();
};

module.exports = Rule;