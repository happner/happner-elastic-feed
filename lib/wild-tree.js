var LRU = require("lru-cache")
  , _ = require('underscore.string')
  , BinarySearchTree = require('binary-search-tree').BinarySearchTree
  , shortid = require('shortid')
  ;

function SubscriptionTree(options) {

  this.options = options ? options : {};

  if (!this.options.cache) this.options.cache = {max: 5000};

  this.__cache = new LRU(this.options.cache);

  this.__segmentCache = new LRU(this.options.cache);

  this.__wildcardSegments = new BinarySearchTree();

  this.__preciseSegments = new BinarySearchTree();

  this.__wildcardCount = 0;

  this.__preciseCount = 0;

  this.__smallestPreciseSegment = 0;

  this.__greatestPreciseSegment = 0;

  this.__smallestWildcardSegment = 0;

  this.__greatestWildcardSegment = 0;
}

SubscriptionTree.prototype.__getSegment = function(path, tree, wildcard){

  var key = path;

  if (wildcard) key += '__WILD';

  var segment = this.__segmentCache.get(key);

  if (segment) return segment;

  segment = tree.search(path.length);

  if (segment.length > 0) {

    this.__segmentCache.set(key, segment[0]);

    return segment[0];
  }

  return null;
};

SubscriptionTree.prototype.__addPrecise = function(path, recipient){

  this.__preciseCount++;

  if (this.__smallestPreciseSegment == 0 || path.length < this.__smallestPreciseSegment)
    this.__smallestPreciseSegment = path.length;

  if (this.__greatestPreciseSegment == 0 || path.length > this.__greatestPreciseSegment)
    this.__greatestPreciseSegment = path.length;

  var segment = path;

  var existingSegment = this.__getSegment(segment, this.__preciseSegments, false);

  if (!existingSegment) {

    existingSegment = {
      subscriptions:new BinarySearchTree()
    };

    this.__preciseSegments.insert(segment.length, existingSegment);
  }

  var subscriptionList = existingSegment.subscriptions;

  var existingSubscription;

  var existingSubscriptions = subscriptionList.search(segment);

  if (existingSubscriptions.length == 0){

    existingSubscription = {recipients:{}};

    subscriptionList.insert(segment, existingSubscription);

  } else existingSubscription = existingSubscriptions[0];

  var existingRecipient = existingSubscription.recipients[recipient.key];

  if (!existingRecipient){

    existingRecipient = {refCount:0, data:{}, previousData:[], segment:path.length, id:shortid.generate()};

    existingSubscription.recipients[recipient.key] = existingRecipient;

  } else  existingRecipient.previousData.push(existingRecipient.data);

  existingRecipient.refCount += recipient.refCount?recipient.refCount:1;

  existingRecipient.data = recipient.data;

  return existingRecipient;
};

SubscriptionTree.prototype.__addWildcard = function(path, recipient){

  this.__wildcardCount++;

  if (this.__smallestWildcardSegment == 0 || path.length < this.__smallestWildcardSegment)
    this.__smallestWildcardSegment = path.length;

  if (this.__greatestWildcardSegment == 0 || path.length > this.__greatestWildcardSegment)
    this.__greatestWildcardSegment = path.length;

  var pathSegments = path.split('*');

  var segment = pathSegments[0];

  var existingSegment = this.__getSegment(segment, this.__wildcardSegments, true);

  if (!existingSegment) {

    existingSegment = {
      subscriptions:new BinarySearchTree()
    };

    this.__wildcardSegments.insert(segment.length, existingSegment);
  }

  var subscriptionList = existingSegment.subscriptions;

  var existingSubscription;

  var existingSubscriptions = subscriptionList.search(segment);

  if (existingSubscriptions.length == 0){

    existingSubscription = {recipients:{}, complex: pathSegments.length > 2 || pathSegments[0] == '*' && pathSegments.length > 1, path:path};

    subscriptionList.insert(segment, existingSubscription);

  } else existingSubscription = existingSubscriptions[0];

  var existingRecipient = existingSubscription.recipients[recipient.key];

  if (!existingRecipient){

    existingRecipient = {refCount:0, data:{}, previousData:[], segment:segment.length, id:shortid.generate()};

    existingSubscription.recipients[recipient.key] = existingRecipient;

  } else  existingRecipient.previousData.push(existingRecipient.data);

  existingRecipient.refCount += recipient.refCount?recipient.refCount:1;

  existingRecipient.data = recipient.data;

  return existingRecipient;
};

SubscriptionTree.prototype.add = function(path, recipient){

  if (path.indexOf('*') > -1) return this.__addWildcard(path, recipient);

  else return this.__addPrecise(path, recipient);
};

SubscriptionTree.prototype.__removeWildcard = function(path, options){

  //TODO: still busy, so this doesnt work yet..

  var segment = path.split('*')[0];

  var existingSegment = this.__segments.search(segment.length);

  if (!options) options = {};

  if (existingSegment) {

    var subscriptionList = existingSegment.subscriptions;

    var existingSubscriptions = subscriptionList.search(segment);

    if (existingSubscriptions.length > 0){

      var existingSubscription = existingSubscriptions[0];

      if (options.recipient){


      } else if (options.id){


      } else {

        subscriptionList.remove(segment);

        return existingSubscription;
      }

    } else return null;
  }
};

SubscriptionTree.prototype.__removePrecise = function(path, options){

  //TODO: still busy, so this doesnt work yet..

  var existingSegments = this.__preciseSegments.search(path);

  var existingSegment;

  if (!options) options = {};

  if (existingSegments.length > 0) {

    existingSegment = existingSegments[0];

    if (options.recipient){

      //remove all for recipient
    } else if (options.id){

      //remove a specific subscription
    } else {

      //remove all on a path
      this.__preciseSegments.remove(path);

      return existingSegment;
    }

  } else return null;
};

SubscriptionTree.prototype.remove = function(path, options){

  //TODO: still busy, so this doesnt work yet..

  if (path.indexOf('*')> 0) return this.__removeWildcard(path, options);

  else return this.__removePrecise(path, options);
};

SubscriptionTree.prototype.__appendRecipientsBySegment = function(path, subscriptionList, appendTo){

  var existingSubscription = subscriptionList.search(path)[0];

  if (existingSubscription == null || existingSubscription.complex && this.__wildcardMatch(existingSubscription.path, path) == false) return;

  appendTo.push(existingSubscription.recipients);
};

SubscriptionTree.prototype.__searchAndAppend = function(path, segments, subscriptions, wildcard){

  var _this = this;

  //get specific subscriptions, and first wildcard
  var existingSegments = segments.search(path.length);

  //get the first segment
  if (existingSegments.length > 0) _this.__appendRecipientsBySegment(path, existingSegments[0].subscriptions, subscriptions);

  if (!wildcard || _this.__wildcardCount == 0) return;

  //get wildcard subscriptions, for everything up to a single character before the whole path
  //ie: /s /si /sim /simp /simpl /simple /simple/ /simple/s /simple/si /simple/sim /simple/simo /simple/simon

  for (var i = path.length  - 1; i >= _this.__smallestWildcardSegment; i--){

    existingSegments = segments.search(i);

    if (existingSegments.length == 0) continue;

    _this.__appendRecipientsBySegment(path.substring(0, i), existingSegments[0].subscriptions, subscriptions);
  }
};

SubscriptionTree.prototype.search = function(path){

  var _this = this;

  var recipients = _this.__cache.get(path);

  if (recipients != null) return recipients;

  else recipients = [];

  _this.__searchAndAppend(path, _this.__preciseSegments, recipients);

  _this.__searchAndAppend(path, _this.__wildcardSegments, recipients, true);

  _this.__cache.set(path, recipients);

  return recipients;
};

module.exports = SubscriptionTree;


