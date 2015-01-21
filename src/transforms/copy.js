define(function(require, exports, module) {
  var util = require('../util/index');

  return function filter(model) {

    var as = [], // the names of the fields
        fields = [], // the field accessors
        from, // the from field accessor
        from_base; // the first element of the from field (foo in foo.bar)

    var node = new model.Node(function(input) {
      var i, len, x, j, len2;
      util.debug(input, ["copying"]);

      for(i = 0, len = input.add.length; i < len; i++) {
        x = input.add[i];
        for(j = 0, len2 = fields.length; j < len2; j++) {
          // promote the field fields[j] of x[from] to field as[j] of x;
          x[as[j]] = fields[j](from(x) || {})
        }
      }

      if(input.fields[from_base]) {
        for(i = 0, len = input.mod.length; i < len; i++) {
          x = input.mod[i];
          for(j = 0, len2 = fields.length; j < len2; j++) {
            // promote the field fields[j] of x[from] to field as[i] of x;
            x[as[j]] = fields[j](from(x) || {})
          }
        }
      }

      return input;
    });

    node.from = function(field) {
      from = util.accessor(field);
      from_base = util.field(field)[0];
      return node;
    };

    node.fields = function(fs) {
      fields = fs.map(util.accessor);
      base_fields = fs.map(function(f) {
        return util.field(f)[0];
      });
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
