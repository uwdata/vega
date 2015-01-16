define(function(require, exports, module) {
  var util = require('../util/index');

  return function filter(model) {

    var as = [], fields = [], from;

    var node = new model.Node(function(input) {
      var i, len, x, j, len2;
      util.debug(input, ["copying"]);


      for(i = 0, len = input.add.length; i < len; i++) {
        x = input.add[i];
        for(j = 0, len2 = fields.length; j < len2; j++) {
          // promote the field fields[j] of x[from] to field as[i] of x;
          x[as[j]] = (x[from] || {})[fields[j]];
        }
      }

      for(i = 0, len = input.mod.length; i < len; i++) {
        x = input.mod[i];
        for(j = 0, len2 = fields.length; j < len2; j++) {
          // promote the field fields[j] of x[from] to field as[i] of x;
          x[as[j]] = (x[from] || {})[fields[j]];
        }
      }

      return input;
    });

    node.from = function(field) {
      from = field;
      return node;
    };

    node.fields = function(fs) {
      fields = fs;
      if(!as.length) as = fs;
      return node;
    };

    node.as = function(fs) {
      as = fs;
      return node;
    };

    return node;
  };
});
