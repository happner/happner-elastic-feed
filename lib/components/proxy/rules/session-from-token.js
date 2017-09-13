function Rule(){

}

Rule.create = function(){
  return new Rule();
};

Rule.prototype.process = function(facts, callback){

};

module.exports = Rule;