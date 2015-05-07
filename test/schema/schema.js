var config = require('../../src/util/config'),
  zs = require('z-schema');

describe('Schema', function() {
  var fs = require("fs");
  var path = require("path");
  var validator = new zs({
    noExtraKeywords: true,
    assumeAdditional: false,
    forceProperties: true
  });

  describe('Examples', function() {
    var schema = JSON.parse(fs.readFileSync("vega2.schema", "utf8"));

    // list all the example json spec files
    var dir = "./examples/spec/"
    expect(fs.statSync(dir).isDirectory()).to.equal(true);
    var files = fs.readdirSync(dir).filter(function(name) {
      return path.extname(name) === ".json";
    });
    expect(files.length).to.be.at.least(15);

    files.forEach(function(file) {
      var name = path.basename(file, ".json");
      it('validates ' + file, function(done) {
        fs.readFile(dir + file, "utf8", function(error, data) {
          expect(error).to.be.null;
          expect(data).to.not.be.null;
          var json = JSON.parse(data);
          var valid = validator.validate(json, schema);
          if (!valid) {
            var errors = validator.getLastErrors();
            errors.forEach(function(error) {
              expect(JSON.stringify(error)).to.be.null;
            });
          }
          done();
        });
      });
    });
  });
})
