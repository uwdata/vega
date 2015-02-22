(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['d3', 'topojson', 'canvas'], factory);
  } else if(typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require('d3'),
      require('topojson'),
      require('canvas'));
  } else {
    // Browser globals (root is window)
    var tj = (typeof topojson === 'undefined') ? null : topojson;

    var canvasMaker = function(width, height) {
      var c = document.createElement('canvas');
      c.setAttribute('width', width || 1);
      c.setAttribute('height', height || 1);
      return c;
    };

    root.vg = factory(d3, tj, canvasMaker);
  }
}(this, function (d3, topojson, canvas) {
    //almond, and your modules will be inlined here
