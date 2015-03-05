define(function(require, exports, module) {
  var util = require('../util/index');

  return function parsePredicate(model, spec) {
    var types = {
      '=':  parseComparator,
      '==': parseComparator,
      '!=': parseComparator,
      '>':  parseComparator,
      '>=': parseComparator,
      '<':  parseComparator,
      '<=': parseComparator,
      'and': parseLogical,
      '&&':  parseLogical,
      'or':  parseLogical,
      '||':  parseLogical,
      'in': parseIn
    };

    function parseSignal(signal, signals) {
      var s = util.field(signal),
          code = "signals["+s.map(util.str).join("][")+"]";
      signals[s.shift()] = 1;
      return code;
    };

    function parseOperands(operands) {
      var decl = [], defs = [],
          signals = {}, db = {};

      util.array(operands).forEach(function(o, i) {
        var signal, name = "o"+i, def = "";
        
        if(o.value !== undefined) def = util.str(o.value);
        else if(o.arg)    def = "args["+util.str(o.arg)+"]";
        else if(o.signal) def = parseSignal(o.signal, signals);
        else if(o.predicate) {
          var pred = model.predicate(o.predicate);
          pred.signals.forEach(function(s) { signals[s] = 1; });
          pred.data.forEach(function(d) { db[d] = 1 });

          util.keys(o.input).forEach(function(k) {
            var i = o.input[k], signal;
            def += "args["+util.str(k)+"] = ";
            if(i.signal)   def += parseSignal(i.signal, signals);
            else if(i.arg) def += "args["+util.str(i.arg)+"]";
            def+=", ";
          });

          def+= "predicates["+util.str(o.predicate)+"](args, db, signals, predicates)";
        }

        decl.push(name);
        defs.push(name+"=("+def+")");
      });

      return {
        code: "var " + decl.join(", ") + ";\n" + defs.join(";\n") + ";\n",
        signals: util.keys(signals),
        data: util.keys(db)
      }
    };

    function parseComparator(spec) {
      var ops = parseOperands(spec.operands);
      if(spec.type == '=') spec.type = '==';

      return {
        code: ops.code + "return " + ["o0", "o1"].join(spec.type) + ";",
        signals: ops.signals,
        data: ops.data
      };
    };

    function parseLogical(spec) {
      var ops = parseOperands(spec.operands),
          o = [], i = 0, len = spec.operands.length;

      while(o.push("o"+i++)<len);
      if(spec.type == 'and') spec.type = '&&';
      else if(spec.type == 'or') spec.type = '||';

      return {
        code: ops.code + "return " + o.join(spec.type) + ";",
        signals: ops.signals,
        data: ops.data
      };
    };

    function parseIn(spec) {
      var o = [spec.item];
      if(spec.range) o.push.apply(o, spec.range);
      if(spec.scale) o.push(spec.scale);

      var ops = parseOperands(o),
          code = ops.code;

      if(spec.data) {
        var field = util.field(spec.field).map(util.str);
        code += "var where = function(d) { return d["+field.join("][")+"] == o0 };\n";
        code += "return db["+util.str(spec.data)+"].filter(where).length > 0;";
      } else if(spec.range) {
        // TODO: inclusive/exclusive range?
        // TODO: inverting ordinal scales
        if(spec.scale) code += "o1 = o3(o1);\no2 = o3(o2);\n";
        code += "return o1 < o2 ? o1 <= o0 && o0 <= o2 : o2 <= o0 && o0 <= o1";
      }

      return {
        code: code, 
        signals: ops.signals, 
        data: ops.data.concat(spec.data ? [spec.data] : [])
      };
    };

    (spec || []).forEach(function(s) {
      var parse = types[s.type](s);
      var pred = Function("args", "db", "signals", "predicates", parse.code);
      pred.signals = parse.signals;
      pred.data = parse.data;
      model.predicate(s.name, pred);
    });

    return spec;
  }
});