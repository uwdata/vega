describe('Copy', function() {


  var values = [
    {"a":{"b":{"c":{"d":{"e":0}}}}},
    {"a":{"b":{"c":{"d":{"e":1}}}}},
    {"a":{"b":{"c":{"d":{"e":2}}}}},
    {"a":{"b":{"c":{"d":{"e":3}}}}},
  ];

  var spec = {
    "data": [{
      "name": "table",
      "values": values,
      "transform": [{"type": "copy", "from": "a.b", "fields":["c", "c.d.e"], "as":["obj", "num"]}]
    }]
  };


  it('should handle initial datasource', function(done) {
    parseSpec(spec, function(model) {
      var ds = model.data('table'),
          values;

      model.fire();
      values = ds.values();

      expect(values).to.have.length(4);
      values.forEach(function(val, i) {
        expect(val.obj).to.be.an('object');
        expect(val.num).to.equal(i);
      });

      done();
    }, viewFactory);
  });

  it('should handle streaming adds', function(done) {
    parseSpec(spec, function(model) {
      var ds = model.data('table'),
          values;

      model.fire();
      values = ds.values();
      expect(values).to.have.length(4);

      ds.add([{"a":{"b":{"c":{"d":{"e":4}}}}}]).fire();
      values = ds.values();

      expect(values).to.have.length(5);
      expect(values[4].num).to.equal(4);
      done();
    }, viewFactory);
  });

  it('should handle streaming mods');
});
