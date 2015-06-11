var dl = require('datalib'),
    d3 = require('d3'),
    tuple = require('../dataflow/tuple'),
    config = require('../util/config'),
    log = require('../util/log');

var DEPS = ["signals", "scales", "data", "fields"];

function properties(model, mark, spec) {
  var code = "",
      names = dl.keys(spec),
      i, len, name, ref, vars = {}, 
      deps = {
        signals: {},
        scales:  {},
        data:    {},
        fields:  {},
        reflow:  false
      };
      
  code += "var o = trans ? {} : item;\n"
        + "  signals.datum = item.datum;\n";  // Stash for dl.template
  
  for (i=0, len=names.length; i<len; ++i) {
    ref = spec[name = names[i]];
    code += (i > 0) ? "\n  " : "  ";
    if(ref.rule) {
      ref = rule(model, name, ref.rule);
      code += "\n  " + ref.code
    } else {
      ref = valueRef(name, ref);
      code += "this.tpl.set(o, "+dl.str(name)+", "+ref.val+");";
    }

    vars[name] = true;
    DEPS.forEach(function(p) {
      if(ref[p] != null) dl.array(ref[p]).forEach(function(k) { deps[p][k] = 1 });
    });
    deps.reflow = deps.reflow || ref.reflow;
  }

  if (vars.x2) {
    if (vars.x) {
      code += "\n  if (o.x > o.x2) { "
            + "\n    var t = o.x;"
            + "\n    this.tpl.set(o, 'x', o.x2);"
            + "\n    this.tpl.set(o, 'x2', t); "
            + "};";
      code += "\n  this.tpl.set(o, 'width', (o.x2 - o.x));";
    } else if (vars.width) {
      code += "\n  this.tpl.set(o, 'x', (o.x2 - o.width));";
    } else {
      code += "\n  this.tpl.set(o, 'x', o.x2);"
    }
  }

  if (vars.xc) {
    if (vars.width) {
      code += "\n  this.tpl.set(o, 'x', (o.xc - o.width/2));";
    } else {
      code += "\n  this.tpl.set(o, 'x', o.xc);";
    }
  }

  if (vars.y2) {
    if (vars.y) {
      code += "\n  if (o.y > o.y2) { "
            + "\n    var t = o.y;"
            + "\n    this.tpl.set(o, 'y', o.y2);"
            + "\n    this.tpl.set(o, 'y2', t);"
            + "};";
      code += "\n  this.tpl.set(o, 'height', (o.y2 - o.y));";
    } else if (vars.height) {
      code += "\n  this.tpl.set(o, 'y', (o.y2 - o.height));";
    } else {
      code += "\n  this.tpl.set(o, 'y', o.y2);"
    }
  }

  if (vars.yc) {
    if (vars.height) {
      code += "\n  this.tpl.set(o, 'y', (o.yc - o.height/2));";
    } else {
      code += "\n  this.tpl.set(o, 'y', o.yc);";
    }
  }
  
  if (hasPath(mark, vars)) code += "\n  item.touch();";
  code += "\n  if (trans) trans.interpolate(item, o);";

  try {
    var encoder = Function("item", "group", "trans", "db", 
      "signals", "predicates", code);
    encoder.tpl  = tuple;
    encoder.util = dl;
    encoder.d3   = d3; // For color spaces
    dl.extend(encoder, dl.template.context);
    return {
      encode:  encoder,
      signals: dl.keys(deps.signals),
      scales:  dl.keys(deps.scales),
      data:    dl.keys(deps.data),
      fields:  dl.keys(deps.fields),
      reflow:  deps.reflow
    }
  } catch (e) {
    log.error(e);
    log.log(code);
  }
}

function hasPath(mark, vars) {
  return vars.path ||
    ((mark==="area" || mark==="line") &&
      (vars.x || vars.x2 || vars.width ||
       vars.y || vars.y2 || vars.height ||
       vars.tension || vars.interpolate));
}

function rule(model, name, rules) {
  var signals = [], scales = [], db = [],
      inputs = [], code = "";

  (rules||[]).forEach(function(r, i) {
    var def = r.predicate,
        predName = def && (def.name || def),
        pred = model.predicate(predName),
        p = "predicates["+dl.str(predName)+"]",
        input = [], args = name+"_arg"+i,
        ref;

    if(dl.isObject(def)) {
      dl.keys(def).forEach(function(k) {
        if(k === "name") return;
        var ref = valueRef(i, def[k]);
        input.push(dl.str(k)+": "+ref.val);
        if(ref.signals) signals.push.apply(signals, dl.array(ref.signals));
        if(ref.scales)  scales.push.apply(scales, dl.array(ref.scales));
      });
    }

    ref = valueRef(name, r);
    if(ref.signals) signals.push.apply(signals, dl.array(ref.signals));
    if(ref.scales)  scales.push.apply(scales, dl.array(ref.scales));

    if(predName) {
      signals.push.apply(signals, pred.signals);
      db.push.apply(db, pred.data);
      inputs.push(args+" = {\n    "+input.join(",\n    ")+"\n  }");
      code += "if("+p+".call("+p+","+args+", db, signals, predicates)) {" +
        "\n    this.tpl.set(o, "+dl.str(name)+", "+ref.val+");";
      code += rules[i+1] ? "\n  } else " : "  }";
    } else {
      code += "{" + 
        "\n    this.tpl.set(o, "+dl.str(name)+", "+ref.val+");"+
        "\n  }\n";
    }
  });

  code = "var " + inputs.join(",\n      ") + ";\n  " + code;
  return {code: code, signals: signals, scales: scales, data: db};
}

function valueRef(name, ref) {
  if (ref == null) return null;

  if (name==="fill" || name==="stroke") {
    if (ref.c) {
      return colorRef("hcl", ref.h, ref.c, ref.l);
    } else if (ref.h || ref.s) {
      return colorRef("hsl", ref.h, ref.s, ref.l);
    } else if (ref.l || ref.a) {
      return colorRef("lab", ref.l, ref.a, ref.b);
    } else if (ref.r || ref.g || ref.b) {
      return colorRef("rgb", ref.r, ref.g, ref.b);
    }
  }

  // initialize value
  var val = null, scale = null, 
      sgRef = {}, fRef = {}, sRef = {},
      signals = [], fields = [], reflow = false;

  if (ref.template !== undefined) {
    val = dl.template.source(ref.template, "signals");
  }

  if (ref.value !== undefined) {
    val = dl.str(ref.value);
  }

  if (ref.signal !== undefined) {
    sgRef = dl.field(ref.signal);
    val = "signals["+sgRef.map(dl.str).join("][")+"]"; 
    signals.push(sgRef.shift());
  }

  if(ref.field !== undefined) {
    ref.field = dl.isString(ref.field) ? {datum: ref.field} : ref.field;
    fRef  = fieldRef(ref.field);
    val = fRef.val;
  }

  if (ref.scale !== undefined) {
    sRef = scaleRef(ref.scale);
    scale = sRef.val;

    // run through scale function if val specified.
    // if no val, scale function is predicate arg.
    if(val !== null || ref.band || ref.mult || ref.offset) {
      val = scale + (ref.band ? ".rangeBand()" : 
        "("+(val !== null ? val : "item.datum.data")+")");
    } else {
      val = scale;
    }
  }
  
  // multiply, offset, return value
  val = "(" + (ref.mult?(dl.number(ref.mult)+" * "):"") + val + ")"
    + (ref.offset ? " + " + dl.number(ref.offset) : "");

  // Collate dependencies
  return {
    val: val,
    signals: signals.concat(dl.array(fRef.signals)).concat(dl.array(sRef.signals)),
    fields:  fields.concat(dl.array(fRef.fields)).concat(dl.array(sRef.fields)),
    scales:  ref.scale ? (ref.scale.name || ref.scale) : null, // TODO: connect sRef'd scale?
    reflow:  reflow || fRef.reflow || sRef.reflow
  };
}

function colorRef(type, x, y, z) {
  var xx = x ? valueRef("", x) : config.color[type][0],
      yy = y ? valueRef("", y) : config.color[type][1],
      zz = z ? valueRef("", z) : config.color[type][2]
      signals = [], scales = [];

  [xx, yy, zz].forEach(function(v) {
    if(v.signals) signals.push.apply(signals, v.signals);
    if(v.scales)  scales.push(v.scales);
  });

  return {
    val: "(this.d3." + type + "(" + [xx.val, yy.val, zz.val].join(",") + ') + "")',
    signals: signals,
    scales: scales
  };
}

// {field: {datum: "foo"} }  -> item.datum.foo
// {field: {group: "foo"} }  -> group.foo
// {field: {parent: "foo"} } -> group.datum.foo
function fieldRef(ref) {
  if(dl.isString(ref)) {
    return {val: dl.field(ref).map(dl.str).join("][")};
  } 

  // Resolve nesting/parent lookups
  var l = ref.level,
      nested = (ref.group || ref.parent) && l,
      scope = nested ? Array(l).join("group.mark.") : "",
      r = fieldRef(ref.datum || ref.group || ref.parent || ref.signal),
      val = r.val,
      fields  = r.fields  || [],
      signals = r.signals || [],
      reflow  = r.reflow  || false; // Nested fieldrefs trigger full reeval of Encoder.

  if(ref.datum) {
    val = "item.datum["+val+"]";
    fields.push(ref.datum);
  } else if(ref.group) {
    val = scope+"group["+val+"]";
    reflow = true;
  } else if(ref.parent) {
    val = scope+"group.datum["+val+"]";
    reflow = true;
  } else if(ref.signal) {
    val = "signals["+val+"]";
    signals.push(dl.field(ref.signal)[0]);
    reflow = true;
  }

  return {val: val, fields: fields, signals: signals, reflow: reflow};
}

// {scale: "x"}
// {scale: {name: "x"}},
// {scale: fieldRef}
function scaleRef(ref) {
  var scale = null,
      fr = null;

  if(dl.isString(ref)) {
    scale = dl.str(ref);
  } else if(ref.name) {
    scale = dl.isString(ref.name) ? dl.str(ref.name) : (fr = fieldRef(ref.name)).val;
  } else {
    scale = (fr = fieldRef(ref)).val;
  }

  scale = "group.scale("+scale+")";
  if(ref.invert) scale += ".invert";  // TODO: ordinal scales

  return fr ? (fr.val = scale, fr) : {val: scale};
}

module.exports = properties;

function valueSchema(type) {
  type = dl.isArray(type) ? {"enum": type} : {"type": type};
  var valRef = {
    "type": "object",
    "allOf": [{"$ref": "#/refs/valueModifiers"}, {
      "oneOf": [{
        "$ref": "#/refs/signal",
        "required": ["signal"]
      }, {
        "properties": {"value": type},
        "required": ["value"]
      }, {
        "properties": {"field": {"$ref": "#/refs/field"}},
        "required": ["field"]
      }, {
        "properties": {"band": {"type": "boolean"}},
        "required": ["band"]
      }]
    }]
  };

  if (type.type === "string") {
    valRef.allOf[1].oneOf.push({
      "properties": {"template": {"type": "string"}},
      "required": ["template"]
    });
  }

  return {
    "oneOf": [{
      "type": "object",
      "properties": {
        "rule": {
          "type": "array",
          "items": {
            "allOf": [{
              "type": "object",
              "properties": {
                "predicate": {
                  "oneOf": [
                    {"type": "string"}, 
                    {
                      "type": "object",
                      "properties": {"name": "string"},
                      "required": ["name"]
                    }
                  ]
                }
              }
            },
            valRef]
          }
        }
      },
      "additionalProperties": false,
      "required": ["rule"]
    },
    valRef]
  };
}

properties.schema = {
  "refs": {
    "field": {
      "title": "FieldRef",
      "oneOf": [
        {"type": "string"},
        {
          "oneOf": [
            {"$ref": "#/refs/signal"},
            {
              "type": "object", 
              "properties": {"datum": {"$ref": "#/refs/field"}},
              "required": ["datum"],
              "additionalProperties": false
            },
            {
              "type": "object", 
              "properties": {
                "group": {"$ref": "#/refs/field"}, 
                "level": {"type": "number"}
              },
              "required": ["group"],
              "additionalProperties": false
            },
            {
              "type": "object", 
              "properties": {
                "parent": {"$ref": "#/refs/field"}, 
                "level": {"type": "number"}
              },
              "required": ["parent"],
              "additionalProperties": false
            }
          ]
        }
      ]
    },

    "scale": {
      "title": "ScaleRef",
      "oneOf": [
        {"$ref": "#/refs/field"},
        {
          "type": "object",
          "properties": {
            "name": {"$ref": "#/refs/field"},
            "invert": {"type": "boolean", "default": false}
          }
        }
      ]
    },

    "valueModifiers": {
      "properties": {
        "mult": {"type": "number"},
        "offset": {"type": "number"},
        "scale": {"$ref": "#/refs/scale"}
      }
    },

    "value": valueSchema({}),
    "numberValue": valueSchema("number"),
    "stringValue": valueSchema("string"),
    "booleanValue": valueSchema("boolean"),
    "arrayValue": valueSchema("array"),

    "colorValue": {
      "title": "ColorRef",
      "oneOf": [{"$ref": "#/refs/stringValue"}, {
        "type": "object",
        "properties": {
          "r": {"$ref": "#/refs/numberValue"},
          "g": {"$ref": "#/refs/numberValue"},
          "b": {"$ref": "#/refs/numberValue"}
        },
        "required": ["r", "g", "b"]
      }, {
        "type": "object",
        "properties": {
          "h": {"$ref": "#/refs/numberValue"},
          "s": {"$ref": "#/refs/numberValue"},
          "l": {"$ref": "#/refs/numberValue"}
        },
        "required": ["h", "s", "l"]
      }, {
        "type": "object",
        "properties": {
          "l": {"$ref": "#/refs/numberValue"},
          "a": {"$ref": "#/refs/numberValue"},
          "b": {"$ref": "#/refs/numberValue"}
        },
        "required": ["l", "a", "b"]
      }, {
        "type": "object",
        "properties": {
          "h": {"$ref": "#/refs/numberValue"},
          "c": {"$ref": "#/refs/numberValue"},
          "l": {"$ref": "#/refs/numberValue"}
        },
        "required": ["h", "c", "l"]
      }]
    }
  },

  "defs": {
    "propset": {
      "title": "Mark property set",
      "type": "object",
      "properties": {
        // Common Properties
        "x": {"$ref": "#/refs/numberValue"},
        "x2": {"$ref": "#/refs/numberValue"},
        "xc": {"$ref": "#/refs/numberValue"},
        "width": {"$ref": "#/refs/numberValue"},
        "y": {"$ref": "#/refs/numberValue"},
        "y2": {"$ref": "#/refs/numberValue"},
        "yc": {"$ref": "#/refs/numberValue"},
        "height": {"$ref": "#/refs/numberValue"},
        "opacity": {"$ref": "#/refs/numberValue"},
        "fill": {"$ref": "#/refs/colorValue"},
        "fillOpacity": {"$ref": "#/refs/numberValue"},
        "stroke": {"$ref": "#/refs/colorValue"},
        "strokeWidth": {"$ref": "#/refs/numberValue"},
        "strokeOpacity": {"$ref": "#/refs/numberValue"},
        "strokeDash": {"$ref": "#/refs/arrayValue"},
        "strokeDashOffset": {"$ref": "#/refs/numberValue"},

        // Group-mark properties
        "clip": {"$ref": "#/refs/booleanValue"},

        // Symbol-mark properties
        "size": {"$ref": "#/refs/numberValue"},
        "shape": valueSchema(["circle", "square", 
          "cross", "diamond", "triangle-up", "triangle-down"]),

        // Path-mark properties
        "path": {"$ref": "#/refs/stringValue"},

        // Arc-mark properties
        "innerRadius": {"$ref": "#/refs/numberValue"},
        "outerRadius": {"$ref": "#/refs/numberValue"},
        "startAngle": {"$ref": "#/refs/numberValue"},
        "endAngle": {"$ref": "#/refs/numberValue"},

        // Area- and line-mark properties
        "interpolate": valueSchema(["linear", "step-before", "step-after", 
          "basis", "basis-open", "cardinal", "cardinal-open", "monotone"]),
        "tension": {"$ref": "#/refs/numberValue"},

        // Image-mark properties
        "url": {"$ref": "#/refs/stringValue"},
        "align": valueSchema(["left", "right", "center"]),
        "baseline": valueSchema(["top", "middle", "bottom"]),

        // Text-mark properties
        "text": {"$ref": "#/refs/stringValue"},
        "dx": {"$ref": "#/refs/numberValue"},
        "dy": {"$ref": "#/refs/numberValue"},
        "radius":{"$ref": "#/refs/numberValue"},
        "theta": {"$ref": "#/refs/numberValue"},
        "angle": {"$ref": "#/refs/numberValue"},
        "font": {"$ref": "#/refs/stringValue"},
        "fontSize": {"$ref": "#/refs/numberValue"},
        "fontWeight": {"$ref": "#/refs/stringValue"},
        "fontStyle": {"$ref": "#/refs/stringValue"}
      },

      "additionalProperties": false
    }
  }
};
