var EventEmitter = require('events').EventEmitter;
var async = require('async');

function RulesEngine(stackname, rules, context){

  this.__stacks = {};

  this.__events = new EventEmitter();

  if (stackname && rules) this.parseRules(stackname, rules, context);
}

RulesEngine.create = function(stackname, rules, context){

  return new RulesEngine(stackname, rules, context);
};

RulesEngine.prototype.emit = emit;

RulesEngine.prototype.on = on;

RulesEngine.prototype.off = off;

function emit(key, data) {

  var _this = this;

  _this.__events.emit(key, data);
}

function on(key, handler) {

  return this.__events.on(key, handler);
}

function off(key, handler) {

  return this.__events.removeListener(key, handler);
}

RulesEngine.prototype.parseRules = function(stackname, rules, context){

  if (!rules || !rules.length) throw new Error('rules must be an array');

  var stack = [];

  rules.forEach(function(ruleConfig){

    var processor = null;//match anything

    if (typeof ruleConfig.processor == 'string') processor = require(ruleConfig.processor).create();

    else if (ruleConfig.processor) processor = ruleConfig.processor;

    if (processor) processor.process = processor.process.bind(context?context:ruleConfig.processor);

    stack.push({processor:processor, config:ruleConfig});
  });

  this.__stacks[stackname] = stack;
};

RulesEngine.prototype.enforce = function(stackname, facts, consequenceHandler){

  var _this = this;

  _this.emit('enforcing-stack', {name:stackname, facts:facts});

  return new Promise(function(resolve, reject){

    async.everySeries(_this.__stacks[stackname], function(stackRule, ruleCB){

      _this.emit('enforcing-rule', {name:stackRule.name, facts:facts});

      var ruleCallback = function(e, cont){

        if (e) _this.emit('enforced-rule-error', {name:stackRule.name, facts:facts, error:e, cont:cont});

        else _this.emit('enforced-rule', {name:stackRule.name, facts:facts, cont:cont});

        ruleCB(e, cont);
      };

      if (!stackRule.processor){

        if (stackRule.config.consequence) return consequenceHandler(stackRule.config.name, facts, stackRule.config.consequence, ruleCallback);

        return ruleCB(null, true);
      }

      stackRule.processor.process(stackRule.config, facts, function(e, result){

        if (e) return ruleCallback(e);

        if (stackRule.config.consequence && stackRule.config.consequence[result]) return consequenceHandler(stackRule.config.name, facts, stackRule.config.consequence[result], ruleCallback);

        ruleCB(null, true);//continue

      });

    }, function(e){

      if (e) return reject(e);

      resolve(facts);
    });
  });
};

module.exports = RulesEngine;