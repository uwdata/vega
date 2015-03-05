define(function(require, exports, module) {
  var Heap = require('heap'),
      Datasource = require('./Datasource'),
      Signal = require('./Signal'),
      changeset = require('./changeset'),
      util = require('../util/index'),
      C = require('../util/constants');

  function Graph() {
    this._stamp = 0;
    this._rank  = 0;

    this._data = {};
    this._signals = {};

    this.doNotPropagate = {};
  }

  var proto = Graph.prototype;

  proto.data = function(name, pipeline, facet) {
    if(arguments.length === 1) return this._data[name];
    return (this._data[name] = new Datasource(this, name, facet)
      .pipeline(pipeline));
  };

  function signal(name) {
    var m = this, i, len;
    if(!util.isArray(name)) return this._signals[name];
    return name.map(function(n) { m._signals[n]; });
  }

  proto.signal = function(name, init) {
    var m = this;
    if(arguments.length === 1) return signal.call(this, name);
    return (this._signals[name] = new Signal(this, name, init));
  };

  proto.signalValues = function(name) {
    var graph = this;
    if(!util.isArray(name)) return this._signals[name].value();
    return name.reduce(function(sg, n) {
      return (sg[n] = graph._signals[n].value(), sg);
    }, {});
  };

  proto.signalRef = function(ref) {
    if(!util.isArray(ref)) ref = util.field(ref);
    var value = this.signal(ref.shift()).value();
    if(ref.length > 0) {
      var fn = Function("s", "return s["+ref.map(util.str).join("][")+"]");
      value = fn.call(null, value);
    }

    return value;
  };

  var schedule = function(a, b) {
    // If the nodes are equal, propagate the non-reflow pulse first,
    // so that we can ignore subsequent reflow pulses. 
    if(a.rank == b.rank) return a.pulse.reflow ? 1 : -1;
    else return a.rank - b.rank; 
  };

  proto.propagate = function(pulse, node) {
    var v, l, n, p, r, i, len, reflowed;

    // new PQ with each propagation cycle so that we can pulse branches
    // of the dataflow graph during a propagation (e.g., when creating
    // a new inline datasource).
    var pq = new Heap(schedule); 

    if(pulse.stamp) throw "Pulse already has a non-zero stamp"

    pulse.stamp = ++this._stamp;
    pq.push({ node: node, pulse: pulse, rank: node.rank() });

    while (pq.size() > 0) {
      v = pq.pop(), n = v.node, p = v.pulse, r = v.rank, l = n._listeners;
      reflowed = p.reflow && n.last() >= p.stamp;

      if(reflowed) continue; // Don't needlessly reflow ops.

      // A node's rank might change during a propagation (e.g. instantiating
      // a group's dataflow branch). Re-queue if it has. T
      // TODO: use pq.replace or pq.poppush?
      if(r != n.rank()) {
        util.debug(p, ['Rank mismatch', r, n.rank()]);
        pq.push({ node: n, pulse: p, rank: n.rank() });
        continue;
      }

      p = this.evaluate(n, p);

      // Even if we didn't run the node, we still want to propagate 
      // the pulse. 
      if (p !== this.doNotPropagate) {
        for (i = 0, len = l.length; i < len; i++) {
          pq.push({ node: l[i], pulse: p, rank: l[i]._rank });
        }
      }
    }
  };

  // Connect a branch of dataflow nodes. 
  // Dependencies get wired to the nearest collector. 
  function forEachNode(branch, fn) {
    var node, collector, i, len;
    for(i=0, len=branch.length; i<len; ++i) {
      node = branch[i];
      if(node.collector()) collector = node;
      fn(node, collector, i);
    }
  }

  proto.connect = function(branch) {
    util.debug({}, ['connecting']);
    var graph = this;
    forEachNode(branch, function(n, c, i) {
      var data = n.dependency(C.DATA),
          signals = n.dependency(C.SIGNALS);

      if(data.length > 0) {
        data.forEach(function(d) { 
          graph.data(d)
            .revises(n.revises())
            .addListener(c);
        });
      }

      if(signals.length > 0) {
        signals.forEach(function(s) { graph.signal(s).addListener(c); });
      }

      if(i > 0) {
        branch[i-1].addListener(branch[i]);
      }
    });

    return branch;
  };

  proto.disconnect = function(branch) {
    util.debug({}, ['disconnecting']);
    var graph = this;

    forEachNode(branch, function(n, c, i) {
      var data = n.dependency(C.DATA),
          signals = n.dependency(C.SIGNALS);

      if(data.length > 0) {
        data.forEach(function(d) { graph.data(d).removeListener(c); });
      }

      if(signals.length > 0) {
        signals.forEach(function(s) { graph.signal(s).removeListener(c) });
      }

      n.disconnect();  
    });

    return branch;
  };

  proto.reevaluate = function(node, pulse) {
    var reflowed = pulse.reflow && node.last() >= pulse.stamp,
        run = !!pulse.add.length || !!pulse.rem.length || node.router();

    run = run || !reflowed;
    return run || node.reevaluate(pulse);
  };

  proto.evaluate = function(node, pulse) {
    if(!this.reevaluate(node, pulse)) return pulse;
    pulse = node.evaluate(pulse);
    node.last(pulse.stamp);
    return pulse
  };

  return Graph;
});