var dl = require('datalib');

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

function parsePredicates(model, spec) {
  (spec || []).forEach(function(s) {
    var parse = types[s.type](model, s),
        pred  = Function("args", "db", "signals", "predicates", parse.code);
    pred.root = function() { return model.scene().items[0] }; // For global scales
    pred.isFunction = dl.isFunction;
    pred.signals = parse.signals;
    pred.data = parse.data;
    model.predicate(s.name, pred);
  });

  return spec;
}

function parseSignal(signal, signals) {
  var s = dl.field(signal),
      code = "signals["+s.map(dl.str).join("][")+"]";
  signals[s.shift()] = 1;
  return code;
}

function parseOperands(model, operands) {
  var decl = [], defs = [],
      signals = {}, db = {};

  dl.array(operands).forEach(function(o, i) {
    var signal, name = "o"+i, def = "";
    
    if(o.value !== undefined) def = dl.str(o.value);
    else if(o.arg)    def = "args["+dl.str(o.arg)+"]";
    else if(o.signal) def = parseSignal(o.signal, signals);
    else if(o.predicate) {
      var ref  = o.predicate,
          predName = ref && (ref.name || ref),
          pred = model.predicate(predName),
          p = "predicates["+dl.str(predName)+"]";

      pred.signals.forEach(function(s) { signals[s] = 1; });
      pred.data.forEach(function(d) { db[d] = 1 });

      if(dl.isObject(ref)) {
        dl.keys(ref).forEach(function(k) {
          if(k === "name") return;
          var i = ref[k], signal;
          def += "args["+dl.str(k)+"] = ";
          if(i.signal)   def += parseSignal(i.signal, signals);
          else if(i.arg) def += "args["+dl.str(i.arg)+"]";
          def+=", ";
        });  
      } 

      def+= p+".call("+p+", args, db, signals, predicates)";
    }

    decl.push(name);
    defs.push(name+"=("+def+")");
  });

  return {
    code: "var " + decl.join(", ") + ";\n" + defs.join(";\n") + ";\n",
    signals: dl.keys(signals),
    data: dl.keys(db)
  }
}

function parseComparator(model, spec) {
  var ops = parseOperands(model, spec.operands);
  if(spec.type == '=') spec.type = '==';

  return {
    code: ops.code + "return " + ["o0", "o1"].join(spec.type) + ";",
    signals: ops.signals,
    data: ops.data
  };
}

function parseLogical(model, spec) {
  var ops = parseOperands(model, spec.operands),
      o = [], i = 0, len = spec.operands.length;

  while(o.push("o"+i++)<len);
  if(spec.type == 'and') spec.type = '&&';
  else if(spec.type == 'or') spec.type = '||';

  return {
    code: ops.code + "return " + o.join(spec.type) + ";",
    signals: ops.signals,
    data: ops.data
  };
}

function parseIn(model, spec) {
  var o = [spec.item], code = "";
  if(spec.range) o.push.apply(o, spec.range);
  if(spec.scale) {
    code = parseScale(spec.scale, o);
  }

  var ops = parseOperands(model, o);
  code = ops.code + code;

  if(spec.data) {
    var field = dl.field(spec.field).map(dl.str);
    code += "var where = function(d) { return d["+field.join("][")+"] == o0 };\n";
    code += "return db["+dl.str(spec.data)+"].filter(where).length > 0;";
  } else if(spec.range) {
    // TODO: inclusive/exclusive range?
    // TODO: inverting ordinal scales
    if(spec.scale) code += "o1 = scale(o1);\no2 = scale(o2);\n";
    code += "return o1 < o2 ? o1 <= o0 && o0 <= o2 : o2 <= o0 && o0 <= o1";
  }

  return {
    code: code, 
    signals: ops.signals, 
    data: ops.data.concat(spec.data ? [spec.data] : [])
  };
}

// Populate ops such that ultimate scale/inversion function will be in `scale` var. 
function parseScale(spec, ops) {
  var code = "var scale = ", 
      idx  = ops.length;

  if(dl.isString(spec)) {
    ops.push({ value: spec });
    code += "this.root().scale(o"+idx+")";
  } else if(spec.arg) {  // Scale function is being passed as an arg
    ops.push(spec);
    code += "o"+idx;
  } else if(spec.name) { // Full scale parameter {name: ..}
    ops.push(dl.isString(spec.name) ? {value: spec.name} : spec.name);
    code += "(this.isFunction(o"+idx+") ? o"+idx+" : ";
    if(spec.scope) {
      ops.push(spec.scope);
      code += "(o"+(idx+1)+".scale || this.root().scale)(o"+idx+")";
    } else {
      code += "this.root().scale(o"+idx+")";
    }
    code += ")"
  }

  if(spec.invert === true) {  // Allow spec.invert.arg?
    code += ".invert"
  }

  return code+";\n";
}

module.exports = parsePredicates;
parsePredicates.schema = {
  "refs": {
    "operand": {
      "type": "object",
      "oneOf": [
        {
          "properties": {"value": {}},
          "required": ["value"]
        },
        {
          "properties": {"arg": {"type": "string"}},
          "required": ["arg"]
        },
        {"$ref": "#/refs/signal"},
        {
          "properties": {
            "predicate": {
              "oneOf": [
                {"type": "string"},
                {
                  "type": "object",
                  "properties": {"name": {"type": "string"}},
                  "required": ["name"]
                }
              ]
            }
          },
          "required": ["predicate"]
        }
      ]
    }
  },

  "defs": {
    "predicate": {
      "type": "object",
      "oneOf": [{
        "properties": {
          "name": {"type": "string"},
          "type": {"enum": ["==", "!=", ">", "<", ">=", "<="]},
          "operands": {
            "type": "array",
            "items": {"$ref": "#/refs/operand"},
            "minItems": 2,
            "maxItems": 2
          }
        },
        "required": ["name", "type", "operands"]
      }, {
        "properties": {
          "name": {"type": "string"},
          "type": {"enum": ["and", "&&", "or", "||"]},
          "operands": {
            "type": "array",
            "items": {"$ref": "#/refs/operand"},
            "minItems": 2
          }
        },
        "required": ["name", "type", "operands"]
      }, {
        "properties": {
          "name": {"type": "string"},
          "type": {"enum": ["in"]},
          "item": {"$ref": "#/refs/operand"}
        },

        "oneOf": [
          {
            "properties": {
              "range": {
                "type": "array",
                "items": {"$ref": "#/refs/operand"},
                "minItems": 2
              },
              "scale": {"$ref": "#/refs/scopedScale"}
            },
            "required": ["range"]
          },
          {
            "properties": {
              "data": {"type": "string"},
              "field": {"type": "string"}
            },
            "required": ["data", "field"]
          }
        ],

        "required": ["name", "type", "item"]
      }]
    }
  }
};