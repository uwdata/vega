    // d3 doesn't expose itself when running under AMD, so
    // we do it manually. 
    // See: https://github.com/mbostock/d3/issues/1693
    define('d3', [], function() { return d3 });
    define('topojson', [], function() { return topojson });

    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return {
      core: {
        View: require('core/View')
      },
      dataflow: {
        changeset: require('dataflow/changeset'),
        Datasource: require('dataflow/Datasource'),
        Graph: require('dataflow/Graph'),
        Node: require('dataflow/Node')
      },
      parse: {
        spec: require('parse/spec')
      },
      scene: {
        Builder: require('scene/Builder'),
        GroupBuilder: require('scene/GroupBuilder')
      },
      util: require('util/index'),
      config: require('util/config'),
      importModule: define // so that node utilities can inject modules
    }
}));
