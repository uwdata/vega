define(function(require, exports, module) {
  var d3 = require('d3'),
      util = require('../../util/index'),
      config = require('../../util/config');

  var renderer = function() {
    this._builder = null;
  };
  
  var prototype = renderer.prototype;
  
  prototype.initialize = function(el, width, height, pad) {
    var SVGBuilder = require('./svg');
    this._builder = new SVGBuilder();

    return this.resize(width, height, pad);
  }

  prototype.resize = function(width, height, pad) {
    this._width = width;
    this._height = height;
    this._padding = pad || {top:0, left:0, bottom:0, right:0};
    this._autopad = util.isString(this._padding) ? 1 : 0;

    var w = this._width, h = this._height, pad = this._padding;
    
    // (re-)configure builder size
    this._builder.initialize(null, w, h, pad);

    return this;
  };

  prototype.render = function(scene, items) {
    // headless always draws the entire scene, ignoring items
    this._builder.render(scene);
    return this;
  };

  prototype.svg = function() {
    return this._builder.svg();
  };
  
  return renderer;
});
