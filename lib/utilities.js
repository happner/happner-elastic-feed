var uuid = require('uuid')
  , util = require('util')
  , fs = require('fs')
  , path = require('path')
  ;


module.exports.getFunctionParameters = function (fn) {
  var args = [];
  var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
  var FN_ARG_SPLIT = /,/;
  var FN_ARG = /^\s*(_?)(.+?)\1\s*$/;
  var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

  if (typeof fn == 'function') {
    fnText = fn.toString().replace(STRIP_COMMENTS, '');
    argDecl = fnText.match(FN_ARGS);
    argDecl[1].split(FN_ARG_SPLIT).map(function (arg) {
      arg.replace(FN_ARG, function (all, underscore, name) {
        args.push(name);
      });
    });
    return args;
  } else return null;
};

module.exports.node = util;

module.exports.randomId = function () {
  return uuid.v4().split('-').join('');
};

module.exports.stringifyError = function(err) {
  var plainError = {};
  Object.getOwnPropertyNames(err).forEach(function(key) {
    plainError[key] = err[key];
  });
  return JSON.stringify(plainError);
};

module.exports.clone = function(){

};

module.exports.removeLeading = function(leading, str){

  if (str === null || str === undefined) return str;
  if (leading == null) return str;
  if (leading == '') return str;

  var cloned = str.toString();
  if (cloned.indexOf(leading) == 0) cloned = cloned.substring(1, cloned.length);

  return cloned;
};

module.exports.removeLast = function(last, str){

  if (str === null || str === undefined) return str;
  if (last == null) return str;
  if (last == '') return str;

  var cloned = str.toString();
  if (cloned[cloned.length - 1] == last) cloned = cloned.substring(0, cloned.length - 1);

  return cloned;
};

module.exports.isPromise = function (promise) {
  return (promise && typeof promise.then === 'function' && typeof promise.catch === 'function')
};

module.exports.splitAndCut =  function(input, splitChar, cut){

  if (!input) return input;

  var parts = input.split(splitChar);

  if (cut == null || cut == -1) return parts;

  if (cut >= parts.length) return parts;

  return parts.slice(cut).join(splitChar);
};

module.exports.getPackageJson = function (fileName) {

  var maxLevels = 5;

  var findPackageJson = function(fileName){
    if(maxLevels-- == 0)
      return {
        version: '1.0.0'
      };

    try{
      var packageJson = require(fileName + path.sep + 'package.json');
      return packageJson;
    }catch(e){
      return findPackageJson(path.dirname(fileName));
    }
  };

  return findPackageJson(fileName);
};

module.exports.getNestedVal = function(obj, properties){

  var foundValue = undefined;

  var propertiesArray =  properties.split('.');

  var currentObj = obj;

  propertiesArray.every(function(propertyName, propertyIndex){

    var value = currentObj[propertyName];

    if (propertyIndex == propertiesArray.length - 1) foundValue = value;
    else if (value == null) return false;
    else currentObj = value;

    return true;
  });

  return foundValue;
};
