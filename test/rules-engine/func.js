describe('happner-elastic-feed-functional-tests', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var request = require('request');

  context('rules', function () {

    it('tests building a rule stack', function (done) {

      var ruleStack = [
        {
          processor:{
            process:function(config, facts, callback){

              if (facts.enforced && facts.enforced.indexOf('once') > -1)
                callback(null, 'match');
              else callback();
            }
          },
          consequence: {
            match: {
              action: 'proxy',
              terminate: true
            }
          }
        },
        {
          processor:{
            process:function(config, facts, callback){

              if (facts.enforced && facts.enforced.indexOf('twice') > -1)
                callback(null, 'match');
              else callback();
            }
          },
          consequence:{
            match:{
              action:'proxy',
              terminate:true
            }
          }
        },
        {
          processor:{
            process:function(config, facts, callback){

              if (facts.enforced && facts.enforced.indexOf('thrice') > -1)
                callback(null, 'match');
              else callback();
            }
          },
          consequence:{
            match:{
              action:'proxy',
              terminate:true
            }
          }
        },
        {
          processor:{
            process:function(config, facts, callback){

              if (facts.enforced && facts.enforced.indexOf('thrice') > -1)
                callback(null, 'nomatch');
              else callback();
            }
          },
          consequence:{
            nomatch:{
              action:"deny",
              event:'happn-token-missing',
              message:'missing happn-token',
              terminate:true
            }
          }
        },
        {
          processor:{
            process:function(config, facts, callback){
              if (facts.enforced && facts.enforced.indexOf('twice') > -1)
                callback(null, 'nomatch');
              else callback();
            }
          },
          consequence:{
            nomatch:{
              action:"deny",
              event:'authorization-failed',
              message:'authorization failed',
              terminate:true
            }
          }
        },
        {
          consequence: {
            action: "proxy",
            event: 'default-rule-reached',
            message: 'default-rule-reached'
          }
        }
      ];

      var testFacts = {};

      var rulesEngine = require('../../lib/components/proxy/rules-engine.js').create('testStack', ruleStack);

      var events = [];

      var logEvent = function(data){
        events.push(data);
      };

      rulesEngine.on('enforcing-stack', logEvent);
      rulesEngine.on('enforcing-rule', logEvent);
      rulesEngine.on('enforced-rule-error', logEvent);
      rulesEngine.on('enforced-rule', logEvent);

      rulesEngine.enforce(
        'testStack',
        testFacts,
        function(facts, config, callback){

          facts.enforced = ['once'];
          callback(null, true);
        })
        .then(function(finalContext){

          return rulesEngine.enforce(
            'testStack',
            finalContext,
            function(facts, config, callback){
              facts.enforced.push('twice');
              callback(null, true);
            })
        })
        .then(function(finalContext){

          return rulesEngine.enforce(
            'testStack',
            finalContext,
            function(facts, config, callback){
              facts.enforced.push('thrice');
              callback(null, true);
            })
        })
        .then(function(finalContext){

          return rulesEngine.enforce(
            'testStack',
            finalContext,
            function(facts, config, callback){
              facts.enforced.push('four times');
              callback(null, true);
            })
        })
        .then(function(finalFacts){
          console.log('final facts:::', finalFacts);
          done();
        })
        .catch(done);
    });
  });

});