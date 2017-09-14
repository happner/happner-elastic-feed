var utilities = require('../../../utilities').create();

function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(config, facts, callback){

  facts.req.cookies = utilities.parseCookies(facts.req);

  var token = facts.req.cookies['happn_token'];

  if (!token) return callback(null, 'nomatch');

  facts.req.token = token;

  callback();//next
};

module.exports = Rule;