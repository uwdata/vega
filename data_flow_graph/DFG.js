//var vega = require("../vega2.js");

function getNodeType(node) {

  var nodeType = "Node";
  // Scene Nodes
  if (node instanceof vg.scene.Bounder) { 
    nodeType = "Bounder";
  } else if (node instanceof vg.scene.GroupBuilder) {
    nodeType = "Group Builder";
  } else if(node instanceof vg.scene.Builder) {
    nodeType = "Builder";
  } else if (node instanceof vg.scene.Scale) {
    nodeType = "Scale";
  } else if (node instanceof vg.scene.Encoder) { 
    nodeType = "Encoder";
  } 
  // Dataflow Nodes
  else if (node instanceof vg.dataflow.Collector) {
    nodeType = "Collector";
  } else if (node instanceof vg.dataflow.Signal) {
    nodeType = "Signal";
  } 
  // Transform Nodes
  else if (node instanceof vg.transforms.index.bin) {
    nodeType = "Bin";
  } else if (node instanceof vg.transforms.index.cross) { 
    nodeType = "Cross";
  } else if (node instanceof vg.transforms.index.facet) { 
    nodeType = "Facet";
  } else if (node instanceof vg.transforms.index.filter) { 
    nodeType = "Filter";
  } else if (node instanceof vg.transforms.index.formula) { 
    nodeType = "Formula";
  } else if (node instanceof vg.transforms.index.fold) { 
    nodeType = "Fold";
  } else if (node instanceof vg.transforms.index.sort) { 
    nodeType = "Sort";
  } else if (node instanceof vg.transforms.index.stats) { 
    nodeType = "Stats";
  } else if (node instanceof vg.transforms.index.unique) { 
    nodeType = "Unique";
  } else if (node instanceof vg.transforms.index.zip) { 
    nodeType = "Zip";
  } 
  // Other Nodes
  else if (node._isInput == true) {
    nodeType = "Data Source Input";
  } else if (node._isOutput == true) {
    nodeType = "Data Source Output";
  }
  return nodeType;
} // end getNodeType

function getNodeTitle(node, obj) {
  var title;
  if(node._name != undefined) {
    title = node._name;
  } else if(obj.type == "Data Source Input") {
    title = "IN";
  } else if(obj.type == "Data Source Output") {
    title = "OUT";
  } else if(node._def != undefined) {
    if(node._def.name != undefined) {
      title = node._def.name;
    } else if (node._def.type != undefined) {
      title = node._def.type
    }
  }
  return title;
} // end getNodeTitle

// Read and parse the specification
d3.text("spec.txt", function(error, data) {
  // Read the specification (parse the JSON)
  var spec;
  try {
    spec = JSON.parse(data);
  } catch (e) {
    console.log(e);
    return;
  }

  // Use Vega to parse the specification
  vg.parse.spec(spec, function(model) {
    var node = model._node;
    var nodes = [node];
    var signals = model.graph._signals;
    for(s in signals) {
      nodes.push(signals[s]);
    }
    extractDataFlow(nodes);
  }, function(model) { 
    model.scene(new vg.dataflow.Node(model.graph)).fire();
    return model; 
  });
}); // end d3.text

// Traverse the tree of listeners to construct the
// data flow graph
function extractDataFlow(inputNodes) {
  var nodesToCheck = inputNodes;
  var nodes = {};
  var edges = {};
  var constraints = [];

  while(nodesToCheck.length != 0) {
    var currentNode = nodesToCheck.pop();

    // Compile metadata about the node
    var obj = {"name": currentNode._id, 
               "type": getNodeType(currentNode)};
    obj["title"] = getNodeTitle(currentNode, obj);
    if(currentNode._def != undefined) {
      obj["def"] = currentNode._def;
    }

    // Add the current node to the dictionary of nodes
    nodes[currentNode._id] = obj;

    // Create edges and enqueue new nodes to be checked
    var children = currentNode._listeners;
    // CONSTRAINT: if only one child, should be inline
    /*if(children.length == 1) {
      constraints.push({"type":"alignment",
       "axis":"x",
       "offsets":[
         {"node":currentNode._id, "offset":"0"},
         {"node":children[0]._id, "offset":"0"}
      ]});
    }*/

    var childAlignment = {
      "type":"alignment",
      "axis":"y",
      "offsets":[]
    }

    for(childID in children) {
      var child = children[childID];
      if(children.length > 1) {
        childAlignment["offsets"].push({"node":child._id, "offset":"0"});
      }
      
      // Add an edge from the current node to the child
      if(!(currentNode._id in edges)) {
        edges[currentNode._id] = [];
      }
      edges[currentNode._id].push(child._id);

      // Add the child node to the nodesToCheck if it
      // has not been processed already
      if(!(child._id in nodes) && !(child in nodesToCheck)) {
        nodesToCheck.push(child);
      }

    } // end for
    //console.log("ALIGNMENT", childAlignment)
    constraints.push(childAlignment);

  } // end while

  toJSON(nodes, edges, constraints);
} // end extractDataFlow

// Convert from dictionary to array format
function toJSON(inputNodes, inputEdges, constraints) {
  var jsonNodes = [];
  var jsonEdges = [];

  for (id in inputNodes) {
    jsonNodes.push(inputNodes[id]);
  }

  for (source in inputEdges) {
    var children = inputEdges[source];
    for (target in children) {
      var edge = {"source": parseInt(source), "target": children[target]};
      jsonEdges.push(edge);
    }
  }

  graph(jsonNodes, jsonEdges, constraints);
} // end toJSON

// Create the graph using cola and d3
function graph(nodes, edges, constraints) {
  var d3cola = cola.d3adaptor().convergenceThreshold(0.1);

  var width = 800, height = 1000;

  //var color = d3.scale.category20();
  var color = d3.scale.ordinal()
    .domain(["Node", "Signal", "Data Source Input", "Data Source Output", "Collector", "Scale", "Group Builder", "Builder", "Bounder"])
    .range(["gray", "#2ca02c", "#e7ba52", "#e7ba52", "#ffbb78", "#1f77b4", "#d62728", "#ff9896", "#ff7f0e", "purple"]);


  var outer = d3.select("body").append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("pointer-events", "all");

  // Enable zooming
  outer.append("rect")
      .attr("class", "background")
      .attr("width", "100%")
      .attr("height", "100%")
      .call(d3.behavior.zoom().on("zoom", redraw));

  var vis = outer.append("g");

  function redraw() {
    vis.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
  }

  // Draw arrowheads on edges
  outer.append("svg:defs").append("svg:marker")
      .attr("id", "end-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
    .append("svg:path")
      .attr("d", "M0,-5L10,0L0,5L2,0")
      .attr("fill", "gray");

  // Add id, width, and height attributes to nodes
  nodes.forEach(function (v, i) { 
    v.id = i;
    v.width = 75;
    v.height = 75;
  });

  // Manually create connections between edges and nodes
  var newEdges = [];
  edges.forEach(function(e) {
    var sourceNode = nodes.filter(function(n) {
        return n.name == e.source;
    })[0],
    targetNode = nodes.filter(function(n) {
            return n.name == e.target;
    })[0];

    newEdges.push({
        source: sourceNode,
        target: targetNode
    });
  });
  edges = newEdges;

  constraints = [{"type":"alignment",
   "axis":"y",
   "offsets":[
     {"node":"56", "offset":"0"},
     {"node":"29", "offset":"0"},
     {"node":"47", "offset":"0"},
     {"node":"38", "offset":"0"}
  ]}
  ]
  console.log(constraints)

  constraints.forEach(function(c) {
    c["offsets"].forEach(function(node) {
      var newNode = nodes.filter(function(n) {
        return n.name == node.node;
      });
      node.node = newNode;
    });
  });

  console.log(constraints)

  // Set up cola layout properties
  d3cola
      .avoidOverlaps(true)
      .flowLayout('y', 150)
      .size([width, height])
      .nodes(nodes)
      .links(edges)
      //.constraints(constraints)
      .jaccardLinkLengths(150);

  var link = vis.selectAll(".link")
      .data(edges)
      .enter().append("path")
      .attr("class", "link")
      .attr("stroke", "#999")
      .style("stroke-width", "3px");

  var margin = 10, pad = 10;

  var node = vis.selectAll(".node")
      .data(nodes)
    .enter().append("rect")
      .attr("class", "node")
      .attr("rx", 5).attr("ry", 5)
      .call(d3cola.drag)
      .style("fill", function(d) { 
        return color(d.type); 
      })
    .on("click", function(d) {
      console.log("Node " + d.name + " def: ", d.def);
    });

  var label = vis.selectAll(".label")
      .data(nodes)
    .enter().append("text")
      .attr("class", "label")
      .text(function (d) { return d.title; })
      .call(d3cola.drag);

  var lineFunction = d3.svg.line()
      .x(function (d) { return d.x; })
      .y(function (d) { return d.y; })
      .interpolate("linear");

  var routeEdges = function () {
    d3cola.prepareEdgeRouting(75);
    link.attr("d", function (d) { return lineFunction(d3cola.routeEdge(d)); });
  }

  d3cola.start(20, 30, 100).on("tick", function () {
    node.each(function (d) { d.innerBounds = d.bounds.inflate(-margin); })
        .attr("x", function (d) { return d.innerBounds.x; })
        .attr("y", function (d) { return d.innerBounds.y; })
        .attr("width", function (d) { return d.innerBounds.width(); })
        .attr("height", function (d) { return d.innerBounds.height(); });
    
    link.attr("d", function (d) {
        cola.vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
        var lineData = [{ x: d.sourceIntersection.x, y: d.sourceIntersection.y }, { x: d.arrowStart.x, y: d.arrowStart.y }];
        return lineFunction(lineData);
    });
    
    label
        .attr("x", function (d) { return d.x })
        .attr("y", function (d) { return d.y + pad });
  }).on("end", routeEdges);

} // end graph