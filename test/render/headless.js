var config = require('../../src/util/config');

describe('Headless', function() {
  var fs = require("fs");

  // Render the given spec using both the headless string renderer and the
  // standard SVG renderer with a fake JSDOM and compare that the SVG
  // output is the same with both
  function compareSVG(name, spec, validator, done) {
    parseSpec(spec, function(viewFactory) {
      // first use the string renderer
      var svg = viewFactory({ renderer: "xml" }).update()._renderer.svg();
      validateSVG(svg, name + "-str", function(doc, xpath) {
        validator(doc, xpath);
      });


      // next render to a fake JSDOM and compare the two SVG blobs
      // TODO: why re-parse the spec? seems we can't re-use the viewFactory...
      parseSpec(spec, function(viewFactory) {
        var d3 = require('d3'), jsdom = require('jsdom');

        jsdom.env({
          features : { QuerySelector : true },
          html : "<html><body><div id='viz'></div></body></html>",
          done : function(errors, window) {
            var el = window.document.querySelector('#viz')

            var view = viewFactory({ renderer: "svg", el: el });
            view.update();
            var svg2 = d3.select(el.firstChild).html();

            // the DOM element doesn't include the namespace; stick it in so the
            // same xpath will validate and XML string equivalence can be tested
            svg2 = svg2.replace(/^<svg ([^>]*)>/,
              '<svg $1 version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">');

            validateSVG(svg2, name + "-svg", function(doc, xpath) {
              validator(doc, xpath);
            });

            // TODO: do the SVGs really need to be identical?
            // expect(svg).to.equal(svg2);

            done();
          }
        });
      });
    });
  };

  // Parse the given SVG blob, save it to a file, and run the validator function
  function validateSVG(svg, saveto, validator) {
      expect(svg).to.not.be.undefined;
      expect(svg).to.not.be.null;
      expect(svg.length).to.be.above(100);

      // ensure we can parse the generated SVG and invoke callback with xpath
      var dom = require('xmldom').DOMParser;
      var selector = require('xpath');
      var xpath = selector.useNamespaces({"svg": "http://www.w3.org/2000/svg"});

      var doc = new dom().parseFromString(svg);

      /* TODO: where to output test case files?
      if (saveto) {
        var out = fs.createWriteStream(saveto + ".svg");
        out.write(svg);
        out.close();
      }
      */

      if (validator) validator(doc, xpath);
  }

  describe('SVG', function() {

    it('renders the same SVG', function(done) {
      var spec = blankSpec;

      // assume we will have at least one mark per data items
      var dcount = (spec.data||[]).reduce(function(s, d) {
        return s + d.values.length;
      }, 0);

      compareSVG("bar", spec, function(doc, xpath) {
        expect(xpath("//svg:rect", doc).length).to.be.at.least(dcount);
      }, done);
    });
  });

  describe('Canvas', function() {

    it('can measure text', function(done) {
      // this test verified that the "canvas" node module works
      var Bounds = require("../../src/core/Bounds");
      var measure = require("../../src/util/bounds").text;

      expect(measure).to.not.be.undefined;

      var text = { text: "Hello There", font: "Courier", fontSize: 52 };
      var bounds = measure(text, new Bounds(), false);

      // allow some leniency since platforms have different font render paths
      expect(bounds.x2 - bounds.x1).to.be.closeTo(345.0, 5.0);
      expect(bounds.y2 - bounds.y1).to.be.closeTo(54.0, 5.0);

      done();
    });

    
    it('should render to a bitmap') /*, function(done) {

      parseSpec(exampleSpecBar, function(model) {
        var renderer = new headless.Renderer();
        var w = spec.width, h = spec.height, pad = spec.padding;

        renderer.initialize("canvas", w, h, pad);
        expect(renderer).to.not.be.undefined;
        renderer.render(model.scene());

        var canvas = renderer.canvas();
        expect(canvas).to.not.be.undefined;
        expect(canvas).to.not.be.null;

        var out = fs.createWriteStream("/Users/mprudhom/Desktop/viz.png");
        var stream = canvas.createPNGStream();

        stream.on("data", function(chunk) {
          out.write(chunk);
        });

        stream.on("end", function() {
          done();
        });

      }, viewFactory);

    });
    */

  });


  var blankSpec = {
    "width": 400,
    "height": 200,
  };

  // examples/spec/bar.json
  var exampleSpecBar = {
    "width": 400,
    "height": 200,
    "padding": {"top": 10, "left": 30, "bottom": 30, "right": 10},
    "data": [
      {
        "name": "table",
        "values": [
          {"x": 1,  "y": 28}, {"x": 2,  "y": 55},
          {"x": 3,  "y": 43}, {"x": 4,  "y": 91},
          {"x": 5,  "y": 81}, {"x": 6,  "y": 53},
          {"x": 7,  "y": 19}, {"x": 8,  "y": 87},
          {"x": 9,  "y": 52}, {"x": 10, "y": 48},
          {"x": 11, "y": 24}, {"x": 12, "y": 49},
          {"x": 13, "y": 87}, {"x": 14, "y": 66},
          {"x": 15, "y": 17}, {"x": 16, "y": 27},
          {"x": 17, "y": 68}, {"x": 18, "y": 16},
          {"x": 19, "y": 49}, {"x": 20, "y": 15}
        ]
      }
    ],
    "scales": [
      {
        "name": "x",
        "type": "ordinal",
        "range": "width",
        "domain": {"data": "table", "field": "x"}
      },
      {
        "name": "y",
        "range": "height",
        "nice": true,
        "domain": {"data": "table", "field": "y"}
      }
    ],
    "axes": [
      {"type": "x", "scale": "x"},
      {"type": "y", "scale": "y"}
    ],
    "marks": [
      {
        "type": "rect",
        "from": {"data": "table"},
        "properties": {
          "enter": {
            "x": {"scale": "x", "field": "x"},
            "width": {"scale": "x", "band": true, "offset": -1},
            "y": {"scale": "y", "field": "y"},
            "y2": {"scale": "y", "value": 0}
          },
          "update": {
            "fill": {"value": "steelblue"}
          },
          "hover": {
            "fill": {"value": "red"}
          }
        }
      }
    ]
  };
})
