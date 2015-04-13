var http = require('http'),
    fs = require('fs'),
    vega = require('../vega2.js'),
    Q = require('q');

function getNodeType(node) {

  var nodeType = "Node";
  // Scene Nodes
  if (node instanceof vega.scene.Bounder) { 
    nodeType = "Bounder";
  } else if (node instanceof vega.scene.GroupBuilder) {
    nodeType = "Group Builder";
  } else if(node instanceof vega.scene.Builder) {
    nodeType = "Builder";
  } else if (node instanceof vega.scene.Scale) {
    nodeType = "Scale";
  } else if (node instanceof vega.scene.Encoder) { 
    nodeType = "Encoder";
  } 
  // Dataflow Nodes
  else if (node instanceof vega.dataflow.Collector) {
    nodeType = "Collector";
  } else if (node instanceof vega.dataflow.Signal) {
    nodeType = "Signal";
  } 
  // Transform Nodes
  else if (node instanceof vega.transforms.index.bin) {
    nodeType = "Bin";
  } else if (node instanceof vega.transforms.index.cross) { 
    nodeType = "Cross";
  } else if (node instanceof vega.transforms.index.facet) { 
    nodeType = "Facet";
  } else if (node instanceof vega.transforms.index.filter) { 
    nodeType = "Filter";
  } else if (node instanceof vega.transforms.index.formula) { 
    nodeType = "Formula";
  } else if (node instanceof vega.transforms.index.fold) { 
    nodeType = "Fold";
  } else if (node instanceof vega.transforms.index.sort) { 
    nodeType = "Sort";
  } else if (node instanceof vega.transforms.index.stats) { 
    nodeType = "Stats";
  } else if (node instanceof vega.transforms.index.unique) { 
    nodeType = "Unique";
  } else if (node instanceof vega.transforms.index.zip) { 
    nodeType = "Zip";
  } 
  // Other Nodes
  else if (node._isInput == true) {
    nodeType = "Data Source Input";
  } else if (node._isOutput == true) {
    nodeType = "Data Source Output";
  }
  return nodeType;
}

/*var data = fs.readFileSync('/Users/Jane/Documents/Quarters/Research/vega/data_flow_graph/stocks.csv', 'utf8')
var lines = data.split("\n")
var json = []
lines.forEach(function(d) {
  var values = d.split(",");
  json.push({"symbol":values[0], "date":Date.parse(values[1]), "price": parseFloat(values[2])});
})
var wstream = fs.createWriteStream('stocks.json');
wstream.write(JSON.stringify(json));
wstream.end();*/

getRoot().then(extractDataFlow).then(toDot).then(graph).then(fromDot).then(toJSON).done();

function getRoot() {
  console.log("START ROOT")
  var promise = Q.defer();

  var data = fs.readFileSync('/Users/Jane/Documents/Quarters/Research/vega/data_flow_graph/spec.txt', 'utf8');

  var spec;
  try {
    spec = JSON.parse(data);
  } catch (e) {
    console.log(e);
    return;
  }

  vega.parse.spec(spec, function(model) {
    console.log("  STARTING NODE")
    var node = model._node;
    var nodes = [node];
    /*var signals = model.graph._signals;
    for(s in signals) {
      nodes.push(signals[s]);
    }*/

    console.log("  ENDING NODE")
    promise.resolve(nodes);
  }, function(model) { 
    console.log("  STARTING MODEL")
    model.scene(new vega.dataflow.Node(model.graph)).fire();
    console.log("  ENDING MODEL")
    return model; 
  });



  console.log("FINISH ROOT")
  return promise.promise
}

function extractDataFlow(nodes) {
  console.log("START EXTRACT")
  var promise = Q.defer();

  var nodesToCheck = nodes;
  var nodes = {};
  var edges = {};

  while(nodesToCheck.length != 0) {
    var currentNode = nodesToCheck.pop();

    //TODO: debugging...
    if(currentNode._id == 46 || currentNode._id == 55 || currentNode._id == 37 || currentNode._id == 28) {
      console.log("    Reading node... " + currentNode._id + ": ")
      currentNode._listeners.forEach(function(d) {
        console.log("        " + d._id)
      })
    }


    var obj = {"name": currentNode._id, "type": getNodeType(currentNode)};
    
    if(currentNode._name != undefined) {
      obj["title"] = currentNode._name;
    } else if(obj.type == "Data Source Input") {
      obj["title"] = "IN";
    } else if(obj.type == "Data Source Output") {
      obj["title"] = "OUT";
    } else if(currentNode._def != undefined) {
      obj["def"] = currentNode._def;
      if(currentNode._def.name != undefined) {
        obj["title"] = currentNode._def.name;
      } else if (currentNode._def.type != undefined) {
        obj["title"] = currentNode._def.type
      }
    }

    nodes[currentNode._id] = obj;

    var children = currentNode._listeners;
    for(childID in children) {
      var child = children[childID];
      if(!(currentNode._id in edges)) {
        edges[currentNode._id] = [];
      }
      edges[currentNode._id].push(child._id);

      //TODO: debugging...
      if(child._id == 46 || child._id == 55 || child._id == 37 || child._id == 28) {
        console.log("    Writing node... " + child._id + ": ")
        child._listeners.forEach(function(d) {
          console.log("        " + d._id)
        })
      }
      if(!(child._id in nodes) && !(child in nodesToCheck)) {
        nodesToCheck.push(child);
      }
    }
  }

  console.log("FINISH EXTRACT")
  promise.resolve({"nodes": nodes, "edges": edges});
  return promise.promise;
}

function toDot(result) {
  console.log("START TODOT")
  var promise = Q.defer();

  var wstream = fs.createWriteStream('autoDot.txt');
  wstream.write("digraph auto {\nsize=\"6,6\";\nnode [color=mediumorchid1, style=filled];\n");
  for(source in result.edges) {
    var children = result.edges[source];
    for(target in children) {
      wstream.write("\"" + source + "\" -> \"" + children[target] + "\";\n");
    }
  }
  wstream.write("}");
  wstream.end();

  console.log("FINISH TODOT")
  promise.resolve(result);
  return promise.promise;
}

function graph(result) {
  console.log("START GRAPH")
  var promise = Q.defer();

  var sys = require('sys')
  var exec = require('child_process').exec;
  function puts(error, stdout, stderr) { 
    sys.puts(stdout);
    promise.resolve(result);
  }
  exec("dot -Tplain autoDot.txt > autoLayout.txt", puts);

  /*var execSync = require("exec-sync");
  execSync.exec("dot -Tplain autoDot.txt > autoLayout.txt");
  promise.resolve(result);*/

  //TODO: need to figure out a better way to do this because it isn't
  //      quite working...
  
  console.log("FINISH GRAPH")
  return promise.promise;
}

function fromDot(result) {
  console.log("START FROMTDOT")
  var promise = Q.defer();

  var data = fs.readFileSync('/Users/Jane/Documents/Quarters/Research/vega/data_flow_graph/autoLayout.txt', 'utf8');
  var lines = data.split("\n");
  for (x in lines) {
    var line = lines[x].split(" ");
    if(line[0] == "node") {
      var o = result.nodes[line[1]];
      o["x"] = line[2];
      o["y"] = line[3];
      result.nodes[line[1]] = o;
    }
  }

  console.log("FINISH FROMDOT")
  promise.resolve(result);
  return promise.promise;
}

function toJSON(result) {
  console.log("START JSON")
  var promise = Q.defer();

  var wstream = fs.createWriteStream('autoD3.json');
  var jsonNodes = [];
  var jsonEdges = [];

  wstream.write("{\n\"nodes\": \n");

  for(id in result.nodes) {
    jsonNodes.push(result.nodes[id]);
  }

  wstream.write(JSON.stringify(jsonNodes) + ",\n");
  wstream.write("\"edges\": \n");

  for(source in result.edges) {
    var children = result.edges[source];
    for (target in children) {
      var s = {"source": parseInt(source), "target": children[target]};
      jsonEdges.push(s)
    }
  }

  wstream.write(JSON.stringify(jsonEdges));
  wstream.write("\n}")
  wstream.end();

  console.log("FINISH JSON")
  promise.resolve();
  return promise.promise;

}

function showGraph() {
  fs.readFile('index.html', function (err, html) {
    console.log("Read file:", html);
    if (err) {
        conosle.log("No file")
    }       
    console.log("open server")
    http.createServer(function(request, response) {  
      console.log("write head")
        response.writeHead(200, {'Content-Type': 'text/html'}); 
        console.log("Write html")
        response.end(html);  
    }).listen(1337, '127.0.0.1');
    console.log('Server running at http://127.0.0.1:1337/');
  });

}