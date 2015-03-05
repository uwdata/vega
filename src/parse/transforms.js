define(function(require, exports, module) {
  var util = require('../util/index'),
      transforms = require('../transforms/index');

  return function parseTransforms(model, def) {
    var tx = new transforms[def.type](model.graph);
    if(def.type == 'facet') {
      var pipeline = (def.transform||[])
        .map(function(t) { return parseTransforms(model, t); });
      tx.pipeline(pipeline);
    }

    // We want to rename output fields before setting any other properties,
    // as subsequent properties may require output to be set (e.g. aggregate).
    if(def.output) tx.output(def.output);

    util.keys(def).forEach(function(k) {
      if(k === 'type' || k === 'output') return;
      if(k === 'transform' && def.type === 'facet') return;
      (tx[k]).set(tx, def[k]);
    });

    return tx;
  }
});