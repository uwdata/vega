define(function(require, exports, module) {
  var util = require('../util/index');

  return function filter(model) {

    var as = [], fields = [], from;

    var node = new model.Node(function(input) {
      util.debug(input, ["copying"]);

      input.add.forEach(function(x) {
        fields.forEach(function(f, i) {
          //promote the field f of x[from] to field as[i] of x
          x[as[i]] = (x[from] || {})[f];
        });
      });

      input.mod.forEach(function(x) {
        fields.forEach(function(f, i) {
          //promote the field f of x[from] to field as[i] of x
          x[as[i]] = (x[from] || {})[f];
        });
      });

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
