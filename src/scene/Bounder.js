var dl = require('datalib'),
    Node = require('../dataflow/Node'),
    Encoder = require('./Encoder'),
    bounds = require('../util/boundscalc'),
    C = require('../util/constants'),
    debug = require('../util/debug');

function Bounder(graph, mark) {
  this._mark = mark;
  return Node.prototype.init.call(this, graph).router(true);
}

var proto = (Bounder.prototype = new Node());

proto.evaluate = function(input) {
  debug(input, ["bounds", this._mark.marktype]);
  var i, ilen, j, jlen, group, legend,
      items = this._mark.items,
      hasLegends = this._mark.marktype == C.GROUP 
        && dl.array(this._mark.def.legends).length > 0;

  if(input.add.length || input.rem.length || !items.length) {
    bounds.mark(this._mark, null, !hasLegends);
  } else {
    input.mod.forEach(function(item) { bounds.item(item); });
  }

  if(hasLegends) {
    for(i=0, ilen=items.length; i<ilen; ++i) {
      group = items[i];
      group._legendPositions = null;
      for(j=0, jlen=group.legendItems.length; j<jlen; ++j) {
        legend = group.legendItems[j];
        Encoder.update(this._graph, input.trans, "vg_legendPosition", legend.items);
        bounds.mark(legend, null, true);
      }
    }

    bounds.mark(this._mark, null, true);
  }

  input.reflow = true;
  return input;
};

module.exports = Bounder;