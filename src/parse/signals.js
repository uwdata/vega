var expr = require('./expr'),
    C = require('../util/constants');

function parseSignals(model, spec) {
  // process each signal definition
  (spec || []).forEach(function(s) {
    var signal = model.signal(s.name, s.init);

    if(s.init && s.init.expr) {
      s.init.expr = expr(s.init.expr);
      signal.value(exprVal(model, s.init));
    }

    if(s.expr) {
      s.expr = expr(s.expr);
      signal.evaluate = function(input) {
        signal.value(exprVal(model, s));
        input.signals[s.name] = 1;
        return input;
      };
      signal.dependency(C.SIGNALS, s.expr.signals);
      s.expr.signals.forEach(function(dep) { model.signal(dep).addListener(signal); });
    }
  });

  return spec;
};

function exprVal(model, spec) {
  var e = spec.expr,
      val = expr.eval(model, e.fn, null, null, null, null, e.signals);
  return spec.scale ? scale(model, spec, val) : val;
}

parseSignals.scale = function scale(model, spec, value) {
  var def = spec.scale,
      name  = def.name || def.signal || def,
      scope = def.scope ? model.signalRef(def.scope.signal) : null;

  if(!scope || !scope.scale) {
    scope = (scope && scope.mark) ? scope.mark.group : model.scene().items[0];
  }

  var scale = scope.scale(name);
  if(!scale) return value;
  return def.invert ? scale.invert(value) : scale(value);
}

module.exports = parseSignals;