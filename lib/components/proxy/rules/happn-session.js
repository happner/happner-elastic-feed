var utilities = require('../../../utilities');

function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  var _this = this;

  if (!facts.req.token) return callback(null, "nomatch");

  _this.__sessionCache.get(facts.req.token, function (e, session) {

      if (e) return callback(e);

      if (!session) {

        session = _this.__happnSecurityService.decodeToken(facts.req.token);

        session.type = 0;

        facts.req.session = session;

        return _this.__sessionCache.set(facts.req.token, session, function (e) {

          if (e) return callback(new Error('__sessionFromToken failed at cache set: ' + e.toString()));

          callback();
        });
      }

      facts.req.session = session;

      return callback();
  });
};

module.exports = Rule;