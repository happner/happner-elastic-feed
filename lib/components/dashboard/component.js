var elasticsearch = require('elasticsearch');

function Dashboard(options){

  this.__options = options;
}

Dashboard.prototype.STATE = {
  INACTIVE:0,
  ACTIVE:1
};

Dashboard.prototype.initialize = function(config, $happn){

  var _this = this;

  return new Promise (function(resolve, reject){

    var client = new elasticsearch.Client(_this.__options);

    client.ping({
      requestTimeout: 30000
    }, function (e) {

      if (e) return reject(e);

      Object.defineProperty(_this, 'db', {value: client});

      return _this.__scanAndDeploy();//check for active undeployed feeds, or active feeds with updated versions
    });
  });
};

Dashboard.prototype.__scanAndDeploy = function(dependancies){
  return new Promise(function(resolve, reject){
    reject(new Error('not implemented'));
  });
};

Dashboard.prototype.__scanTemplateDependancies = function(){

  return new Promise(function(resolve, reject){
    reject(new Error('not implemented'));
  });
};

Dashboard.prototype.__updateTemplatePaths = function(){

  return new Promise(function(resolve, reject){
    reject(new Error('not implemented'));
  });
};

Dashboard.prototype.fromTemplate = function(templateDashboardId, feed){

  var _this = this;

  return new Promise(function(resolve, reject){

    if (templateDashboardId == null) return reject(new Error('missing argument templateDashboardId'));

    if (feed == null) return reject(new Error('missing argument feed'));

    var elasticMessage = {
      "index": ".kibana",
      //"type": "",
      "body": {
        "query": {
          "bool": {
            "must": [{
              "terms": {
                "_id": [templateDashboardId]
              }
            }]
          }
        }
      }
    };

    var returnTemplate;

    _this.db.search(elasticMessage)

      .then(function (resp) {

        return new Promise(function(resolveSearch, rejectSearch){

          if (resp.hits && resp.hits.hits && resp.hits.hits.length > 0) {

            resolveSearch({
              feed:feed,
              raw:resp.hits.hits[0]
            });

          } else return rejectSearch(new Error('failed to find template with id: ' + id));
        });
      })
      .then(function(template){

        returnTemplate = template;

        return _this.__scanTemplateDependancies(template);//check our template doesnt rely on other objects
      })
      .then(function(dependancies) {

        returnTemplate.rawDependancies = dependancies;

        return _this.__updateTemplatePaths(returnTemplate);//replace the template index paths with the feeds ones
      })
      .then(function(){

        resolve(returnTemplate);
      })
      .catch(reject);

  });
};

Dashboard.prototype.__serializeTemplates = function(templates){

  return templates.map(function(template){

    return {
      name:template.name,
      description:template.description,
      id:template.id,
      version:template.version
    }
  });
};

Dashboard.prototype.listTemplates = function(options){

  var _this = this;

  return new Promise(function(resolve, reject){

    var elasticMessage = {
      "index": ".kibana",
      //"type": "",
      "body": {
        "query": {
          "match_all": {}
        }
      }
    };

    _this.db.search(elasticMessage)

      .then(function (resp) {

        if (resp.hits && resp.hits.hits && resp.hits.hits.length > 0) {

          return resolve(_this.__serializeTemplates(resp.hits.hits));

        } else return resolve([]);

      })
      .catch(reject);
  });
};

Dashboard.prototype.__validate = function(options, callback){

  if (!options) return reject('options argument missing');
  if (!options.feed || !options.feed.id) return reject('options.feed missing');
  if (!options.dependancies) return reject('options.dependancies missing');
  if (!options.json) return reject('options.json missing');

};

Dashboard.prototype.__ensureHappnerDashboard = function(options){
  return new Promise(function(resolve, reject){
    reject(new Error('not implemented'));
  });
};

Dashboard.prototype.__deployDependancies = function(dependancies){
  return new Promise(function(resolve, reject){
    reject(new Error('not implemented'));
  });
};

Dashboard.prototype.__deployDashboard = function(dependancies){
  return new Promise(function(resolve, reject){
    reject(new Error('not implemented'));
  });
};

Dashboard.prototype.deploy = function(options, $happn){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.__validate(options);

    _this.__ensureHappnerDashboard(options)
      .then(function(dashboardRecord){
        return _this.__deployDependancies(options.dependancies);
      })
      .then(function(dependancies){
        return _this.__deployDashboard(options.json);
      })
  });
};

module.exports = Dashboard;