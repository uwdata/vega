define(function(require, exports, module) {
  var Transform = require('./Transform'),
      util = require('../util/index'),
      bins = require('../util/bins'),
      tuple = require('../dataflow/tuple');

  function Bin(graph) {
    Transform.prototype.init.call(this, graph);
    Transform.addParameters(this, {
      on: {type: "field"},
      min: {type: "value"},
      max: {type: "value"},
      step: {type: "value"},
      maxbins: {type: "value", default: 20}
    });

    this._output = {"bin": "bin"};
    return this;
  }

  var proto = (Bin.prototype = new Transform());

  proto.transform = function(input) {
    var transform = this,
        output = this._output.bin;
        
    var b = bins({
      min: this.min.get(),
      max: this.max.get(),
      step: this.step.get(),
      maxbins: this.maxbins.get()
    });

    function update(d) {
      var v = transform.on.get().accessor(d);
      v = v == null ? null
        : b.start + b.step * ~~((v - b.start) / b.step);
      tuple.set(d, output, v, input.stamp);
    }
    input.add.forEach(update);
    input.mod.forEach(update);
    input.rem.forEach(update);

    return input;
  };

  return Bin
});