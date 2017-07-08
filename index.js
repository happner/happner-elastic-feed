var Promise = require('bluebird');

function ElasticFeedService(){

}

ElasticFeedService.feed = require('./lib/feed');
ElasticFeedService.portal = require('./lib/portal');
ElasticFeedService.queue = require('./lib/queue');
ElasticFeedService.service = require('./lib/service');

module.exports = ElasticFeed;