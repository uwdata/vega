define(function(require, exports, module) {
  var Graph = require('../dataflow/Graph'), 
      Node  = require('../dataflow/Node'),
      GroupBuilder = require('../scene/GroupBuilder'),
      changeset = require('../dataflow/changeset'), 
      util = require('../util/index');

  function Model() {
    this._defs = {};
    this._predicates = {};
    this._scene = null;

    this.graph = new Graph();

    this._node = new Node(this.graph);
    this._builder = null; // Top-level scenegraph builder
  };

  var proto = Model.prototype;

  proto.defs = function(defs) {
    if (!arguments.length) return this._defs;
    this._defs = defs;
    return this;
  };

  proto.data = function() {
    var data = this.graph.data.apply(this.graph, arguments);
    if(arguments.length > 1) {  // new Datasource
      this._node.addListener(data.pipeline()[0]);
    }

    return data;
  };

  // FIXME: https://github.com/uwdata/vega/issues/28
  proto.width = function(width) {
    if (this._defs) this._defs.width = width;
    if (this._defs && this._defs.marks) this._defs.marks.width = width;
    if (this._scene) this._scene.items[0].width = width;
    // this._reset.axes = true;
    return this;
  };

  // FIXME: https://github.com/uwdata/vega/issues/28
  proto.height = function(height) {
    if (this._defs) this._defs.height = height;
    if (this._defs && this._defs.marks) this._defs.marks.height = height;
    if (this._scene) this._scene.items[0].height = height;
    // this._reset.axes = true;
    return this;
  };

  function predicates(name) {
    var m = this, predicates = {};
    if(!util.isArray(name)) return this._predicates[name];
    name.forEach(function(n) { predicates[n] = m._predicates[n] });
    return predicates;
  }

  proto.predicate = function(name, predicate) {
    if(arguments.length === 1) return predicates.call(this, name);
    return (this._predicates[name] = predicate);
  };

  proto.predicates = function() { return this._predicates; };

  proto.scene = function(renderer) {
    if(!arguments.length) return this._scene;
    if(this._builder) this._node.removeListener(this._builder.disconnect());
    this._builder = new GroupBuilder(this, this._defs.marks, this._scene={});
    this._node.addListener(this._builder.connect());
    var p = this._builder.pipeline();
    p[p.length-1].addListener(renderer);
    return this;
  };

  proto.addListener = function(l) { this._node.addListener(l); };
  proto.removeListener = function(l) { this._node.removeListener(l); };

  proto.fire = function(cs) {
    if(!cs) cs = changeset.create();
    this.graph.propagate(cs, this._node);
  };

  return Model;
});
