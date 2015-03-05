define(function(require, exports, module) {
  var changeset = require('./changeset'), 
      tuple = require('./tuple'), 
      Node = require('./Node'),
      Collector = require('./Collector'),
      util = require('../util/index'),
      C = require('../util/constants');
  
  function Datasource(graph, name, facet) {
    this._graph = graph;
    this._name = name;
    this._data = [];
    this._source = null;
    this._facet = facet;
    this._input = changeset.create();
    this._output = null;    // Output changeset

    this._pipeline  = null; // Pipeline of transformations.
    this._collector = null; // Collector to materialize output of pipeline
    this._revises = false; // Does any pipeline operator need to track prev?
  };

  var proto = Datasource.prototype;

  proto.source = function(src) {
    if(!arguments.length) return this._source;
    return (this._source = this._graph.data(src));
  };

  proto.add = function(d) {
    var prev = this._revises ? null : undefined;

    this._input.add = this._input.add
      .concat(util.array(d).map(function(d) { return tuple.ingest(d, prev); }));
    return this;
  };

  proto.remove = function(where) {
    var d = this._data.filter(where);
    this._input.rem = this._input.rem.concat(d);
    return this;
  };

  proto.update = function(where, field, func) {
    var mod = this._input.mod,
        prev = this._revises ? null : undefined; 

    this._input.fields[field] = 1;
    this._data.filter(where).forEach(function(x) {
      var prev = x[field],
          next = func(x);
      if (prev !== next) {
        tuple.set(x, field, next);
        if(mod.indexOf(x) < 0) mod.push(x);
      }
    });
    return this;
  };

  proto.values = function(data) {
    if(!arguments.length)
      return this._collector ? this._collector.data() : this._data;

    // Replace backing data
    this._input.rem = this._data.slice();
    if (data) { this.add(data); }
    return this;
  };

  function set_prev(d) { if(d._prev === undefined) d._prev = C.SENTINEL; }

  proto.revises = function(p) {
    if(!arguments.length) return this._revises;

    // If we've not needed prev in the past, but a new dataflow node needs it now
    // ensure existing tuples have prev set.
    if(!this._revises && p) {
      this._data.forEach(set_prev);
      this._input.add.forEach(set_prev); // New tuples that haven't yet been merged into _data
    }

    this._revises = this._revises || p;
    return this;
  };

  proto.last = function() { return this._output; };

  proto.fire = function(input) {
    if(input) this._input = input;
    this._graph.propagate(this._input, this._pipeline[0]); 
  };

  proto.pipeline = function(pipeline) {
    var ds = this, n, c;
    if(!arguments.length) return this._pipeline;

    if(pipeline.length) {
      // If we have a pipeline, add a collector to the end to materialize
      // the output.
      ds._collector = new Collector(this._graph);
      pipeline.push(ds._collector);
      ds._revises = pipeline.some(function(p) { return p.revises(); });
    }

    // Input node applies the datasource's delta, and propagates it to 
    // the rest of the pipeline. It receives touches to reflow data.
    var input = new Node(this._graph)
      .router(true)
      .collector(true);

    input.evaluate = function(input) {
      util.debug(input, ["input", ds._name]);

      var delta = ds._input, 
          out = changeset.create(input);

      if(input.reflow) {
        out.mod = ds._data.slice();
      } else {
        // update data
        var delta = ds._input;
        var ids = util.tuple_ids(delta.rem);

        ds._data = ds._data
          .filter(function(x) { return ids[x._id] !== 1; })
          .concat(delta.add);

        // reset change list
        ds._input = changeset.create();

        out.add = delta.add; 
        out.mod = delta.mod;
        out.rem = delta.rem;
      }

      return (out.facet = ds._facet, out);
    };

    pipeline.unshift(input);

    // Output node captures the last changeset seen by this datasource
    // (needed for joins and builds) and materializes any nested data.
    // If this datasource is faceted, materializes the values in the facet.
    var output = new Node(this._graph)
      .router(true)
      .collector(true);

    output.evaluate = function(input) {
      util.debug(input, ["output", ds._name]);
      var output = changeset.create(input, true);

      if(ds._facet) {
        ds._facet.values = ds.values();
        input.facet = null;
      }

      ds._output = input;
      output.data[ds._name] = 1;
      return output;
    };

    pipeline.push(output);

    this._pipeline = pipeline;
    this._graph.connect(ds._pipeline);
    return this;
  };

  proto.listener = function() { 
    var l = new Node(this._graph),
        dest = this,
        prev = this._revises ? null : undefined;

    l.evaluate = function(input) {
      this._cache = this._cache || {};  // to propagate tuples correctly
      var output  = changeset.create(input);

      output.add = input.add.map(function(t) {
        return (l._cache[t._id] = tuple.derive(t, t._prev !== undefined ? t._prev : prev));
      });
      output.mod = input.mod.map(function(t) { return l._cache[t._id]; });
      output.rem = input.rem.map(function(t) { 
        var o = l._cache[t._id];
        l._cache[t._id] = null;
        return o;
      });

      return (dest._input = output);
    };

    l.addListener(this._pipeline[0]);
    return l;
  };

  proto.addListener = function(l) {
    if(l instanceof Datasource) {
      if(this._collector) this._collector.addListener(l.listener());
      else this._pipeline[0].addListener(l.listener());
    } else {
      this._pipeline[this._pipeline.length-1].addListener(l);      
    }

    return this;
  };

  proto.removeListener = function(l) {
    this._pipeline[this._pipeline.length-1].removeListener(l);
  };

  return Datasource;
});