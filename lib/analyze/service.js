var LineReaderSync = require("line-reader-sync")
  , fs = require('fs')
  , callsites = require('callsites')
  , path = require('path')
  , uuid = require('uuid')
  ;

function Analyzer(){

  this.__modules = {};

  this.__callerPath = callsites()[1].getFileName();

  this.__callerDir = path.dirname(this.__callerPath);
}

Analyzer.prototype.__metrics = {};

Analyzer.prototype.getAnalysis = function(){

  return this.__metrics;
};

Analyzer.prototype.__getModulePath = function(modulePath){

  if (modulePath.substring(modulePath.length - 3, modulePath.length) != '.js') modulePath += '.js';

  if (path.isAbsolute(modulePath)) return modulePath;

  if (modulePath.indexOf('.') == -1) throw new Error('a relative file path must be used - this library is for analyzing local modules, bad path: ' + modulePath);

  return  path.resolve(this.__callerDir, modulePath);
};

Analyzer.prototype.require = function(path, analyze){

  var modulePath = this.__getModulePath(path);

  var oldModule = require(modulePath);

  if (!analyze) return oldModule;

  var outputPath = modulePath + '.analyzed.js';

  this.__tryUnlink(outputPath);

  var lineReader = new LineReaderSync(modulePath);

  var line = '';

  while(line != null){

    var line = lineReader.readline();

    var beginTag = null, endTag = null;

    if (line != null){

      beginTag = this.__findBeginTag(line);

      if (!beginTag){

        endTag = this.__findEndTag(line);
      }

      if (beginTag) this.__emitTag(beginTag, outputPath, oldModule.name);

      else if (endTag) this.__emitTag(endTag, outputPath, oldModule.name);

      else this.__emitLine(line, outputPath);
    }
  }

  var newModule = require(outputPath);

  return this.__attachAnalyzer(newModule, modulePath);
};

Analyzer.prototype.__emitLine = function(line, outputPath){

  fs.appendFileSync(outputPath, line + '\r\n');
};

Analyzer.prototype.__emitTag = function(tag, outputPath, oldModuleName){

  if (tag.tagType == 'start') fs.appendFileSync(outputPath, 'var startRef_' +  tag.key + ' = ' +  tag.self + '.__averageTimeStart("' + tag.key + '","' + oldModuleName + '");' + '\r\n');

  if (tag.tagType == 'end') fs.appendFileSync(outputPath, tag.self + '.__averageTimeEnd("' + tag.key + '","' + oldModuleName + '", startRef_' + tag.key + ');' + '\r\n');
};

Analyzer.prototype.__findTag = function(line, tagType){

  try{

    var startTag = '[' + tagType + ':';

    var analyzeDirectiveStart = line.indexOf(startTag);

    var tag = null;

    if (analyzeDirectiveStart > -1) {

      var analyzeDirectiveEnd = line.indexOf(':' + tagType + ']');

      if (analyzeDirectiveEnd == -1) throw new Error('bad analyze tag, no closing tag for ' + startTag);

      tag = JSON.parse(line.substring(analyzeDirectiveStart + startTag.length, analyzeDirectiveEnd));

      if (!tag.key) throw new Error('bad analyze tag, no key for ' + startTag);

      if (!tag.self) tag.self = 'this';//could be _this, _self etc. etc.

      tag.tagType = tagType
    }

    return tag;

  }catch(e){

    throw new Error('tag format bad: ' + e.toString())
  }
};

Analyzer.prototype.__findBeginTag = function(line){

  return this.__findTag(line, 'start');
};

Analyzer.prototype.__findEndTag = function(line){

  return this.__findTag(line, 'end');
};

Analyzer.prototype.__attachAnalyzer = function(module, absolutePath){

  var _this = this;

  module.prototype.__analyzed = {
    started: {},
    accumulated: {},
    duration: {},
    counters: {},
    averages: {}
  };

  module.prototype.__averageTimeStart = function (key, moduleName) {

    var startKey = uuid.v4();

    var startTime = Date.now();

    this.__analyzed.started[startKey] = startTime;

    this.__analyzed.started[key] = startTime;

    if (!_this.__metrics[moduleName]) _this.__metrics[moduleName] = {};

    return startKey;
  };

  module.prototype.__averageTimeEnd = function (key, moduleName, startRef) {

    var startKey;

    if (startRef != null) startKey = startRef;

    else startKey = key;

    if (!this.__analyzed.counters[key]) this.__analyzed.counters[key] = 0;

    if (!this.__analyzed.accumulated[key]) this.__analyzed.accumulated[key] = 0;

    this.__analyzed.counters[key]++;

    this.__analyzed.accumulated[key] += Date.now() - this.__analyzed.started[startKey];

    this.__analyzed.averages[key] = this.__analyzed.accumulated[key] / this.__analyzed.counters[key];

    _this.__metrics[moduleName][key] = this.__analyzed.averages[key];

    //console.log('ended:::', key, moduleName, startRef, _this.__metrics, _this.is);
  };

  this.__modules[absolutePath] = module;

  return module;
};

Analyzer.prototype.__tryUnlink = function(path){

  try{

    fs.unlinkSync(path);

  }catch(e){

    if (e.toString().indexOf('no such file or directory') == -1) {
      return e;
    }
  }
  return null;
};

Analyzer.prototype.cleanup = function(){

  var cleanupErrors = [];

  var _this = this;

  Object.keys(this.__modules).forEach(function(originalPath){

    var error = _this.__tryUnlink(originalPath + '.analyzed.js');

    if (error) cleanupErrors.push(error.toString());
  });

  if (cleanupErrors.length > 0) throw new Error('cleanup failed with errors:' + cleanupErrors.join('\r\n'));
};

module.exports = Analyzer;