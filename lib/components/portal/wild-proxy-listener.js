var async = require('async')
  , Cache = require('redis-lru-cache')
  , PareTree = require('wild-pare')
  , async = require('async')
  , EventEmitter = require('events').EventEmitter
  ;

function WildProxyListener(config, rules, $happn) {

  var _this = this;

  if (!config.name) throw new Error('listener missing name argument');

  if (!config.target) throw new Error('listener ' + config.name + ' missing target argument');

  if (!config.port) throw new Error('listener ' + config.name + ' missing port argument');

  this.__events = new EventEmitter();

  _this.__config = config;

  _this.$happn = $happn;

  _this.__setupRuleStack(rules);

  _this.__setupCache();
}

/* create, listen and stop */

WildProxyListener.create = function (config, rules, $happn) {

  return new WildProxyListener(config, rules, $happn);
};

WildProxyListener.prototype.listen = listen;

WildProxyListener.prototype.stop = stop;

/* handle request and rules s*/

WildProxyListener.prototype.__setupRuleStack = __setupRuleStack;

WildProxyListener.prototype.__getRuleStack = __getRuleStack;

WildProxyListener.prototype.__applyRule = __applyRule;

WildProxyListener.prototype.__handleRequest = __handleRequest;

/* cache set up */

WildProxyListener.prototype.__setupCache = __setupCache;

/* events */

WildProxyListener.prototype.emit = emit;

WildProxyListener.prototype.on = on;

WildProxyListener.prototype.off = off;

function emit(key, data, $happn) {

  var _this = this;

  if ($happn) {

    //[start:{"key":"emit", "self":"_this"}:start]

    $happn.emit(key, data, function (e) {

      //[end:{"key":"emit", "self":"_this"}:end]

      if (e) _this.__events.emit('emit-failure', [key, data]);
    });
  }

  _this.__events.emit(key, data);
}

function on(key, handler) {

  return this.__events.on(key, handler);
}

function off(key, handler) {

  return this.__events.removeListener(key, handler);
}


function listen () {

  var _this = this;

  return new Promise(function (resolve, reject) {

    try {


      if (_this.__config.protocol == 'https') _this.__server = require('https-proxy');

      else _this.__server = require('http-proxy');

      _this.__proxy = _this.__server.createProxyServer({target: _this.__config.target}).listen(_this.__config.port);

      _this.__proxy.on('proxyReq', _this.__handleRequest.bind(_this));

      resolve();

    } catch (e) {

      reject(e);
    }
  });
}

function stop () {

  var _this = this;

  return new Promise(function (resolve, reject) {

    try {

      if (_this.__proxy) _this.__proxy.close();

      return resolve();

    } catch (e) {
      console.warn('unable to stop wild-proxy-listener: ' + e.toString());
      reject(e);
    }
  });
}

function __setupRuleStack (rules) {

  var _this = this;

  if (_this.__config.ruleStack == null) _this.__config.ruleStack = {cache: 1000};

  _this.__ruleStack = new PareTree(_this.__config.ruleStack);

  var steps = [];

  if (!_this.__config.rule) {
    steps.push({path: '*', name: 'default-transparent'});
  }

  rules.forEach(function (rule) {

    //if a rule has not been set for the listener, we select a rule with a matching name
    if ( (_this.__config.rule != null && rule.name == _this.__config.rule)
      || (_this.__config.rule == null && rule.name == _this.__config.name)) {

      if (!rule.steps || rule.steps.length == 0) {

        if (!rule.path) rule.path = '*';

        steps.push(rule);
      }

      else rule.steps.forEach(function (ruleStep) {
        steps.push(ruleStep);
      });
    }
  });

  steps.forEach(function (step, stepIndex) {

    _this.__ruleStack.add(step.path, {key: step.name + stepIndex, data:{rule: step, order: stepIndex}});
  });
}

function __getRuleStack (url) {

  var stackResponse = this.__ruleStack.search(url);

  return stackResponse.sort(function (a, b) {

    return a.data.order > b.data.order;
  }).map(function (stackItem) {

    return stackItem.data.rule
  })
}

function __applyRule (ruleEvent, ruleCB) {

  if (!ruleEvent.rule.handler) return ruleCB(null, !ruleEvent.terminate);

  try{

    ruleEvent.rule.handler.apply(ruleEvent.rule.handler, [ruleEvent.proxyReq, ruleEvent.req, ruleEvent.res, ruleEvent.$happn, ruleEvent.rule])

      .then(function () {
        return ruleCB(null, !ruleEvent.rule.terminate);
      })
      .catch(ruleCB)

  } catch(e){

    console.warn('failed to apply rule: ' + ruleEvent.rule.name + ', are you sure you have made the rule return a promise?');
    ruleCB(e);
  }
}

function __handleRequest (proxyReq, req, res, options) {

  var _this = this;

  _this.emit('started-request', req.url);

  var rulesStack = _this.__getRuleStack(req.url);

  var currentRule;

  async.everySeries(rulesStack, function (rule, ruleCB) {

      currentRule = {
        rule: rule,
        proxyReq: proxyReq,
        req: req,
        res: res,
        options: options,
        $happn: _this.$happn
      };

      _this.emit('rule-applying', {rule: currentRule.rule.name});

      _this.__applyRule(currentRule, ruleCB);

    }, function (e) {

      if (e) _this.emit('rule-error', {rule: currentRule.rule.name, error: e.toString()}, _this.$happn);

      _this.emit('completed-request', req.url);
    }
  )
}

function __setupCache (){

  var _this = this;

  if (_this.__config.cache) {

    if (_this.__config.cache === true) _this.__config.cache = {
      cacheId: 'wild-proxy:' + config.name,
      lru: {
        max: 1000
      }
    };

    _this.__stackCache = new Cache(_this.__config.cache);

    _this.__oldGetRuleStack = _this.__getRuleStack;

    //override the getstack to check and update the cache
    _this.__getRuleStack = function (url) {

      var cached = _this.__stackCache.get(url);

      if (cached) return cached;

      var toCache = _this.__oldGetRuleStack(url);

      if (!toCache) return null;

      _this.__stackCache.set(url, toCache);

      return toCache;
    }
  }
}

module.exports = WildProxyListener;