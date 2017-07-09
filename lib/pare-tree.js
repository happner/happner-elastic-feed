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

  this.__wildcardRightSegments = new BinarySearchTree();

  this.__wildcardLeftSegments = new BinarySearchTree();

  this.__preciseSegments = new BinarySearchTree();

  this.__allRecipients = new BinarySearchTree();

  this.__wildcardCount = 0;

  this.__preciseCount = 0;

  this.__smallestPreciseSegment = 0;

  this.__greatestPreciseSegment = 0;

  this.__smallestWildcardRightSegment = 0;

  this.__greatestWildcardRightSegment = 0;

  this.__smallestWildcardLeftSegment = 0;

  this.__greatestWildcardLeftSegment = 0;

  this.__subscriptionIds = 0;
}

SubscriptionTree.prototype.__getSegment = function (path, tree, wildcard) {

  var key = path;

  if (wildcard) key += '__WILD';

  var segment = this.__segmentCache.get(key);

  if (segment) return segment;

  segment = tree.search(path.length)[0];

  this.__segmentCache.set(key, segment);

  return segment;
};

SubscriptionTree.prototype.__addAll = function (path, recipient) {

  var existingRecipient = this.__allRecipients.search(recipient.key)[0];

  if (existingRecipient == null) existingRecipient = {refCount: 0, data: {}, segment: path.length, path:path};

  var subscriptionId = this.__subscriptionId();

  existingRecipient.refCount += recipient.refCount ? recipient.refCount : 1;

  existingRecipient.data[subscriptionId] = recipient.data;

  return {
    recipient: existingRecipient,
    id: subscriptionId
  };
};

SubscriptionTree.prototype.__addPrecise = function (path, recipient) {

  this.__preciseCount++;

  if (this.__smallestPreciseSegment == 0 || path.length < this.__smallestPreciseSegment)
    this.__smallestPreciseSegment = path.length;

  if (this.__greatestPreciseSegment == 0 || path.length > this.__greatestPreciseSegment)
    this.__greatestPreciseSegment = path.length;

  var segment = path;

  var existingSegment = this.__getSegment(segment, this.__preciseSegments, false);

  if (!existingSegment) {

    existingSegment = {
      subscriptions: new BinarySearchTree()
    };

    this.__preciseSegments.insert(segment.length, existingSegment);
  }

  var subscriptionList = existingSegment.subscriptions;

  var existingSubscription = subscriptionList.search(segment)[0];

  if (existingSubscription == null) {

    existingSubscription = {recipients: {}};

    subscriptionList.insert(segment, existingSubscription);
  }

  var existingRecipient = existingSubscription.recipients[recipient.key];

  if (!existingRecipient) {

    existingRecipient = {refCount: 0, data: {}, segment: path.length, path:path};

    existingSubscription.recipients[recipient.key] = existingRecipient;
  }

  var subscriptionId = this.__subscriptionId();

  existingRecipient.refCount += recipient.refCount ? recipient.refCount : 1;

  existingRecipient.data[subscriptionId] = recipient.data;

  return {recipient: existingRecipient, id: subscriptionId};
};

SubscriptionTree.prototype.__subscriptionId = function () {

  return this.__subscriptionIds++;
};

SubscriptionTree.prototype.__addWildcardRight = function (path, pathSegments, recipient, complex) {

  var segment = pathSegments[0];

  var existingSegment = this.__getSegment(segment, this.__wildcardRightSegments, true);

  if (!existingSegment) {

    existingSegment = {
      subscriptions: new BinarySearchTree()
    };

    this.__wildcardRightSegments.insert(segment.length, existingSegment);
  }

  if (this.__smallestWildcardRightSegment == 0 || segment.length < this.__smallestWildcardRightSegment)
    this.__smallestWildcardRightSegment = segment.length;

  if (this.__greatestWildcardRightSegment == 0 || segment.length > this.__greatestWildcardRightSegment)
    this.__greatestWildcardRightSegment = segment.length;

  var subscriptionList = existingSegment.subscriptions;

  var existingSubscription;

  var existingSubscriptions = subscriptionList.search(segment);

  if (existingSubscriptions.length == 0) {

    existingSubscription = {recipients: {}, complex: complex, path: path};

    subscriptionList.insert(segment, existingSubscription);

  } else existingSubscription = existingSubscriptions[0];

  var existingRecipient = existingSubscription.recipients[recipient.key];

  if (!existingRecipient) {

    existingRecipient = {refCount: 0, data: {}, segment: segment.length, path:path};

    existingSubscription.recipients[recipient.key] = existingRecipient;
  }

  existingRecipient.refCount += recipient.refCount ? recipient.refCount : 1;

  var subscriptionId = this.__subscriptionId();

  existingRecipient.data[subscriptionId] = recipient.data;

  return {recipient: existingRecipient, id: subscriptionId};
};

SubscriptionTree.prototype.__addWildcardLeft = function (path, pathSegments, recipient, complex) {

  var segment = pathSegments[pathSegments.length - 1];

  var existingSegment = this.__getSegment(segment, this.__wildcardLeftSegments, true);

  if (!existingSegment) {

    existingSegment = {
      subscriptions: new BinarySearchTree()
    };

    this.__wildcardLeftSegments.insert(segment.length, existingSegment, pathSegments);
  }

  if (this.__smallestWildcardLeftSegment == 0 || segment.length < this.__smallestWildcardLeftSegment)
    this.__smallestWildcardLeftSegment = segment.length;

  if (this.__greatestWildcardLeftSegment == 0 || segment.length > this.__greatestWildcardLeftSegment)
    this.__greatestWildcardLeftSegment = segment.length;

  var subscriptionList = existingSegment.subscriptions;

  var existingSubscription;

  var existingSubscriptions = subscriptionList.search(segment);

  if (existingSubscriptions.length == 0) {

    existingSubscription = {recipients: {}, complex: complex, path: path};

    subscriptionList.insert(segment, existingSubscription);

  } else existingSubscription = existingSubscriptions[0];

  var existingRecipient = existingSubscription.recipients[recipient.key];

  if (!existingRecipient) {

    existingRecipient = {refCount: 0, data: {}, segment: segment.length};

    existingSubscription.recipients[recipient.key] = existingRecipient;
  }

  existingRecipient.refCount += recipient.refCount ? recipient.refCount : 1;

  var subscriptionId = this.__subscriptionId();

  existingRecipient.data[subscriptionId] = recipient.data;

  return {recipient: existingRecipient, id: subscriptionId};
};

SubscriptionTree.prototype.__addWildcard = function (path, recipient) {

  this.__wildcardCount++;

  var pathSegments = path.split('*');

  var wildcardIndex = path.indexOf('*');

  var pathLength = path.length;

  //path lile /test/*/blah, or /*/blah/*longer/side
  if (pathSegments.length > 2 || wildcardIndex > 0 && wildcardIndex < pathLength) {
    //path like /test/long/*/short
    if (pathSegments[0].length > pathSegments[pathSegments.length - 1].length) return this.__addWildcardRight(path, pathSegments, recipient, true);
    //path like /short/*/test/long or /short/*/*/test/long
    return this.__addWildcardLeft(path, pathSegments, recipient, true);
  }

  //path lile */test
  if (wildcardIndex == 0) return this.__addWildcardLeft(path, pathSegments, recipient);
  //path lile /test/*
  return this.__addWildcardRight(path, pathSegments, recipient);
};

SubscriptionTree.prototype.add = function (path, recipient) {

  if (path.indexOf('*') > -1) {

    if (path.replace(/[*]/g, '') == '') return this.__addAll(path, recipient);

    return this.__addWildcard(path, recipient);
  }
  return this.__addPrecise(path, recipient);
};

SubscriptionTree.prototype.__removeWildcard = function (path, options) {

  //TODO: still busy, so this doesnt work yet..

  var segment = path.split('*')[0];

  var existingSegment = this.__segments.search(segment.length);

  if (!options) options = {};

  if (existingSegment) {

    var subscriptionList = existingSegment.subscriptions;

    var existingSubscriptions = subscriptionList.search(segment);

    if (existingSubscriptions.length > 0) {

      var existingSubscription = existingSubscriptions[0];

      if (options.recipient) {


      } else if (options.id) {


      } else {

        subscriptionList.remove(segment);

        return existingSubscription;
      }

    } else return null;
  }
};

SubscriptionTree.prototype.__removePrecise = function (path, options) {

  //TODO: still busy, so this doesnt work yet..

  var existingSegments = this.__preciseSegments.search(path);

  var existingSegment;

  if (!options) options = {};

  if (existingSegments.length > 0) {

    existingSegment = existingSegments[0];

    if (options.recipient) {

      //remove all for recipient
    } else if (options.id) {

      //remove a specific subscription
    } else {

      //remove all on a path
      this.__preciseSegments.remove(path);

      return existingSegment;
    }

  } else return null;
};

SubscriptionTree.prototype.remove = function (path, options) {

  //TODO: still busy, so this doesnt work yet..

  if (path.indexOf('*') > 0) return this.__removeWildcard(path, options);

  else return this.__removePrecise(path, options);
};

SubscriptionTree.prototype.__wildcardMatch = function (pattern, matchTo) {

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));

  var matchResult = matchTo.match(regex);

  if (matchResult) return true;

  return false;
};

SubscriptionTree.prototype.__appendRecipientsBySegment = function (path, subscriptionList, appendTo) {

  if (subscriptionList == null) return;

  var existingSubscription = subscriptionList.subscriptions.search(path)[0];

  if (existingSubscription == null || existingSubscription.complex && this.__wildcardMatch(existingSubscription.path, path) == false) return;

  appendTo.push(existingSubscription.recipients);
};


SubscriptionTree.prototype.__searchAndAppendWildcardRight = function (path, segments, subscriptions) {

  //get wildcard subscriptions, for everything up to a single character before the whole path:
  //ie: /s /si /sim /simp /simpl /simple /simple/ /simple/s /simple/si /simple/sim /simple/simo /simple/simon

  if (this.__wildcardCount == 0) return;

  for (var i = this.__smallestWildcardRightSegment; i <= this.__greatestWildcardRightSegment; i++) {

    this.__appendRecipientsBySegment(path.substring(0, i), segments.search(i)[0], subscriptions);
  }
};

SubscriptionTree.prototype.__searchAndAppendWildcardLeft = function (path, segments, subscriptions) {

  //get wildcard subscriptions, for everything up to a single character before the whole path:
  //ie: /s /si /sim /simp /simpl /simple /simple/ /simple/s /simple/si /simple/sim /simple/simo /simple/simon

  if (this.__wildcardCount == 0) return;

  for (var i = path.length; i >= this.__smallestWildcardLeftSegment; i--) {

    var segment = path.substring(path.length - i, path.length);

    this.__appendRecipientsBySegment(segment, segments.search(i)[0], subscriptions);
  }
};

SubscriptionTree.prototype.__searchAndAppendPrecise = function (path, recipients) {

  var subscriptionList = this.__preciseSegments.search(path.length);

  if (subscriptionList[0]) this.__appendRecipientsBySegment(path, subscriptionList[0], recipients);
};

SubscriptionTree.prototype.__searchAndAppendAll = function (path, recipients) {

  var recipientsObj = {};

  this.__allRecipients.data.forEach(function(recipient){
    recipientsObj[recipient.key] = recipient;
  });

  recipients.push(recipientsObj);
};

SubscriptionTree.prototype.search = function (path) {

  var recipients = this.__cache.get(path);

  if (recipients != null) return recipients;

  else recipients = [];

  this.__searchAndAppendPrecise(path, recipients);

  this.__searchAndAppendWildcardRight(path, this.__wildcardRightSegments, recipients);

  this.__searchAndAppendWildcardLeft(path, this.__wildcardLeftSegments, recipients);

  this.__searchAndAppendAll(path, recipients);

  this.__cache.set(path, recipients);

  return recipients;
};

module.exports = SubscriptionTree;


