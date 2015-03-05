define(function(require, exports, module) {
  var Transform = require('./Transform'),
      util = require('../util/index'),
      C = require('../util/constants');

  function Pie(graph) {
    Transform.prototype.init.call(this, graph);
	Transform.addParameters(this, { value : { type : 'field' } });
	Transform.addParameters(this, { sort : { type : 'value' } });
    return this;
  }

  var proto = (Pie.prototype = new Transform());


  proto.transform = function(input, reset) {

    var start = 0;
	var end = 2 * Math.PI;

	var value = this.value.get(this._graph);
	var s = this.sort.get(this._graph);

	if( input.add.length || input.mod.length || input.rem.length ){
		
		var values = input.add.map(function(v){ return value.accessor(v); }),
			a = start,
			k = (end - start) / d3.sum(values),
			index = d3.range(input.add.length);

		if( s ){
			index.sort(function(a, b) {
				return values[a] - values[b];
			});
		}

		index.forEach(function(i){
			var d = value.accessor(input.add[i]);
			input.add[i].startAngle = a;
			input.add[i].midAngle = (a + 0.5 * d * k);
			input.add[i].endAngle = (a += d *k );
			input.add[i].index = i;
			input.add[i].value = d;
		});
	}

    return input; 
  };

  return Pie;
});
