define(function(require, exports, module) {
  var Transform = require('./Transform'),
      tuple = require('../dataflow/tuple'),
      changeset = require('../dataflow/changeset'),
      util = require('../util/index'),
      C = require('../util/constants');

  function Aggregate(graph) {
    if(graph) this.init(graph);
    return this; 
  }

  var proto = (Aggregate.prototype = new Transform());

  proto.init = function(graph) {
    this._refs  = []; // accessors to groupby fields
    this._cells = {};
    return Transform.prototype.init.call(this, graph)
      .router(true).revises(true);
  };

  proto.data = function() { return this._cells; };

  proto._reset = function(input, output) {
    var k, c;
    for(k in this._cells) {
      if(!(c = this._cells[k])) continue;
      output.rem.push(c.tpl);
    }
    this._cells = {};
  };

  proto._keys = function(x) {
    var keys = this._refs.reduce(function(g, f) {
      return ((v = f(x)) !== undefined) ? (g.push(v), g) : g;
    }, []), k = keys.join("|"), v;
    return keys.length > 0 ? {keys: keys, key: k} : undefined;
  };

  proto._cell = function(x) {
    var k = this._keys(x);
    return this._cells[k.key] || (this._cells[k.key] = this._new_cell(x, k));
  };

  proto._new_cell = function(x, k) {
    return {
      cnt: 0,
      tpl: this._new_tuple(x, k),
      flg: C.ADD_CELL
    };
  };

  proto._new_tuple = function(x, k) {
    return tuple.derive(null, null);
  };

  proto._add = function(x) {
    var cell = this._cell(x);
    cell.cnt += 1;
    cell.flg |= C.MOD_CELL;
    return cell;
  };

  proto._rem = function(x) {
    var cell = this._cell(x);
    cell.cnt -= 1;
    cell.flg |= C.MOD_CELL;
    return cell;
  };

  proto._mod = function(x, reset) {
    if(x._prev && x._prev !== C.SENTINEL && this._keys(x._prev) !== undefined) {
      this._rem(x._prev);
      return this._add(x);
    } else if(reset) { // Signal change triggered reflow
      return this._add(x);
    }
    return this._cell(x);
  };

  proto.transform = function(input, reset) {
    var aggregate = this,
        output = changeset.create(input),
        k, c, f, t;

    if(reset) this._reset(input, output);

    input.add.forEach(function(x) { aggregate._add(x); });
    input.mod.forEach(function(x) { aggregate._mod(x, reset); });
    input.rem.forEach(function(x) {
      if(x._prev && x._prev !== C.SENTINEL && aggregate._keys(x._prev) !== undefined) {
        aggregate._rem(x._prev)
      } else {
        aggregate._rem(x);
      }
    });

    for(k in this._cells) {
      c = this._cells[k];
      if(!c) continue;
      f = c.flg, t = c.tpl;

      if(c.cnt === 0) {
        if(f === C.MOD_CELL) output.rem.push(t);
        this._cells[k] = null;
      } else if(f & C.ADD_CELL) {
        output.add.push(t);
      } else if(f & C.MOD_CELL) {
        output.mod.push(t)
      }
      c.flg = 0;
    }

    return output;
  }

  return Aggregate;
});