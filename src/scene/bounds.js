define(function(require, exports, module) {
  var boundsCalc = require('../util/bounds'),
      constants = require('../util/constants');

  return function bounds(model, mark) {
    var node = new model.Node(function(input) {
      global.debug(input, ["bounds", mark.marktype]);

      boundsCalc.mark(mark);
      if(mark.marktype === constants.GROUP) 
        boundsCalc.mark(mark, null, false);

      input.touch = true;
      return input;
    });
    return node;
  }
});