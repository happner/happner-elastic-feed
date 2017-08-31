function Utilities() {

}

Utilities.prototype.happnUtils = function ($happn) {
  return $happn.data.services.utilities;
};

Utilities.prototype.cloneArray = function (arr, reverse) {

  if (!arr) return [];

  if (!Array.isArray(arr)) throw new Error('must be of type Array');

  var cloned = arr.map(function (r) {
    return r;
  });

  if (reverse) return cloned.reverse();

  return cloned;
};

module.exports = Utilities;
