define(function(require, exports, module) {
  var expr = require('../parse/expr'),
      util = require('../util/index'),
      C = require('../util/constants');

  var arrayType = /array/i,
      fieldType = /field/i,
      exprType  = /expr/i;

  function Parameter(name, type) {
    this._name = name;
    this._type = type;
    this._stamp = 0; // Last stamp seen on resolved signals

    // If parameter is defined w/signals, it must be resolved
    // on every pulse.
    this._value = [];
    this._accessors = [];
    this._resolution = false;
    this._signals = {};
  }

  var proto = Parameter.prototype;

  proto._get = function() {
    var isArray = arrayType.test(this._type),
        isField = fieldType.test(this._type);

    if(isField) {
      return isArray ? { fields: this._value, accessors: this._accessors } :
        { field: this._value[0], accessor: this._accessors[0] };
    } else {
      return isArray ? this._value : this._value[0];
    }
  };

  proto.get = function(graph) {
    var isField = fieldType.test(this._type),
        s, sg, idx, val, last;

    // If we don't require resolution, return the value immediately.
    if(!this._resolution) return this._get();

    for(s in this._signals) {
      idx  = this._signals[s];
      sg   = graph.signal(s); 
      val  = sg.value();
      last = sg.last();

      if(isField) {
        this._accessors[idx] = this._stamp <= last ? 
          util.accessor(val) : this._accessors[idx];
      }

      this._value[idx] = val;
      this._stamp = Math.max(this._stamp, last);
    }

    return this._get();
  };

  proto.set = function(transform, value) {
    var param = this, 
        isExpr = exprType.test(this._type),
        isField = fieldType.test(this._type);

    this._value = util.array(value).map(function(v, i) {
      if(!util.isObject(v)) {
        if(isExpr) {
          var e = expr(transform._graph, v);
          transform.dependency(C.FIELDS,  e.fields);
          transform.dependency(C.SIGNALS, e.signals);
          return e.fn;
        } else if(isField) {  // Backwards compatibility
          param._accessors[i] = util.accessor(v);
          transform.dependency(C.FIELDS, v);
        }

        return v;
      } else if(v.value !== undefined) {
        return v.value;
      } else if(v.field !== undefined) {
        param._accessors[i] = util.accessor(v.field);
        transform.dependency(C.FIELDS, v.field);
        return v.field;
      } else if(v.signal !== undefined) {
        param._resolution = true;
        param._signals[v.signal] = i;
        transform.dependency(C.SIGNALS, v.signal);
        return v.signal;
      }
    });

    return transform;
  };

  return Parameter;
})