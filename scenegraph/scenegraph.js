/*
 * Both forms of scenegraph updates have their own sets of problems as 
 * to how they should be implemented. I outline these challenges as
 * follows:
 * 
 *********************************************************************
 * Update Specification:
 * 
 *    Every time the user selects "parse" the specification is parsed
 *    from scratch. This means that all of the internal IDs are lost
 *    and replaced with new ones. Therefore, it is not immediately
 *    easy to connect nodes from one iteration of the specification to
 *    nodes in the other. The IDs currently used to construct the
 *    scenegraph are based on some of the internal data, but this
 *    format will not work well since the main thing of interest is to
 *    see how the internal data changes. Relying on structure also will
 *    not work since it will be impossible to distinguish things such
 *    as small multiple visualizations.
 * 
 *********************************************************************
 * Update User Interaction:
 * 
 *    The changes based on interaction happen somewhere internally
 *    that I have not identified as of yet. However, these sorts of
 *    changes do NOT recreate the entire scenegraph, they just update
 *    the relevant components. This will make actually updating the
 *    scenegraph visualization easier (and is likely more interesting)
 *    but requires hooking the visualization of the scenegraph into
 *    the internals which would probably not be ideal.
 *
 *********************************************************************
 * Other tasks that could be completed include:
 *    1. Figure out how to simplify the scenegraph visualization
 *       (e.g. don't automatically expand all the nodes, only expand
 *        a subset and then provide more fine grained controls for
 *        showing and hiding all nodes).
 *    2. Figure out some of the logic about how to connect scenegraph
 *       elements to the specification.
 *    3. Figure out how to set up the repository to store this work.
 *
 */

var flatData, data, i, duration, root, tree, svg, diagonal;
var init = false;
var AUTO_COLLAPSE_THREASHOLD = 7;

//TODO: rename...
function tryThis() {
  d3.select("#scenegraph").selectAll("*").remove();
  extractScenegraph(this);
}

function getID(group) {
  var id = group.marktype + ".";
  id += group.bounds.x1 + group.bounds.x2 + group.bounds.y1 + group.bounds.y2;
  if(group.def.width && group.def.height) id += group.def.width + group.def.height;
  if(group.def.from) id += group.def.from.data;
  return id;
} // end getID

/*
 * There are two types of nodes in the scenegraph, Group marks and Items.
 * GROUP: <name>, <type>, <parent>
 * ITEM:  <name>, <parent>, <data> 
 */
function extractScenegraph(node) {
  init = false;
  var nodes = [];

  var ID = getID(node);
  nodes.push({"name": ID, "type": node.marktype, "parent": "null"});

  var nodesToCheck = node.items.slice(0);

  while(nodesToCheck.length != 0) {
    var currentNode = nodesToCheck.pop();
    
    if(currentNode.marktype != undefined) {
      // If the CURRENT node is a GROUP mark.
      var ID = getID(currentNode);
      var parentID = currentNode.group._id;
      var obj = {"name": ID, "type": currentNode.marktype, "parent": parentID};
      nodes.push(obj);

      nodesToCheck = nodesToCheck.concat(currentNode.items);

    } else {
      // If the CURRENT node is an ITEM.
      var parentID = getID(currentNode.mark)
      var obj = {"name": currentNode._id, "parent": parentID};
      
      // If we are updating the scenegraph (i.e. we have data already),
      // save the old data for comparison later.
      if(flatData) {
        var oldNode = flatData.filter(function(d) {
          if(d.name == currentNode._id) {
            return d;
          }
        })[0];
        if(oldNode) {
          obj["oldData"] = oldNode.data;
          if(oldNode.myColor) obj["myColor"] = oldNode.myColor;
        }
      }

      // Save relevant data for the scenegraph
      var dataObj = {};
      // TODO: figure out what information is important for an ITEM
      if(currentNode.text != undefined) {
        dataObj["text"] = currentNode.text;
      }
      if(currentNode.key != undefined) {
        dataObj["key"] = currentNode.key;
      }
      if(currentNode.fill != undefined) {
        dataObj["fill"] = currentNode.fill;
      }

      obj["data"] = dataObj;
      nodes.push(obj);

      if(currentNode.axisItems != undefined && currentNode.axisItems.length != 0) {
        nodesToCheck = nodesToCheck.concat(currentNode.axisItems);
      }
      if(currentNode.items != undefined && currentNode.items.length != 0) {
        nodesToCheck = nodesToCheck.concat(currentNode.items);
      }
    }
  } // end while
  drawGraph(nodes);
} // end extractScenegraph

//
// Based on:  http://www.d3noob.org/2014/01/tree-diagrams-in-d3js_11.html
//            http://bl.ocks.org/mbostock/4339083
// 
function drawGraph(nodes) {

  flatData = nodes.slice(0);
  // Structure the nodes appropriately.
  var dataMap = nodes.reduce(function(map, node) {
    map[node.name] = node;
    return map;
  }, {});

  var treeData = [];
    nodes.forEach(function(node) {
      var parent = dataMap[node.parent];
      if (parent) {
        (parent.children || (parent.children = [])).push(node);
      } else {
        treeData.push(node);
      }
  });

  data = treeData;
  var margin = {top: 20, right: 05, bottom: 20, left: 05};
  var width = d3.select("#vis")[0][0].offsetWidth - margin.right - margin.left;
  var height = 800 - margin.top - margin.bottom;
    
  i = 0,
  duration = 750;

  tree = d3.layout.tree()
      .size([width, height]);

  diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.x, d.y]; });

  svg = d3.select("#scenegraph").append("svg")
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  root = data[0];
  root.x0 = 0;
  root.y0 = height / 2;

  //root.children.forEach(collapse);
  //root.children.forEach(partialCollapse);
  update(root);

  d3.select(self.frameElement).style("height", "800px");
} // end drawGraph

// TODO: update functionality to look for repeated patterns in the
//       structure of the scenegraph and collapse regularly repeated
//       structures (e.g. scatterplot matrix)
function partialCollapse(d) {
  if(d.children) {
    // Determine how many of the children are leaf nodes
    var leaves = d.children.filter(function(child) {
      if(!child.children || child.children.length == 0) return child;
    });

    // If most of the children are leaf nodes, collapse the node.
    if(leaves.length >= AUTO_COLLAPSE_THREASHOLD) collapse(d);
    // Otherwise, leave the node visible and recurse.
    else d.children.forEach(partialCollapse);
  }
} // end partialCollapse

function collapse(d) {
  if(d.children) {
    d._children = d.children;
    d._children.forEach(collapse);
    d.children = null;
  }
} // end collapse

function expand(d) {
  if (d._children) {
    d.children = d._children;
    d.children.forEach(expand);
    d._children = null;
  } else if (d.children) {
    d.children.forEach(expand);
  }
} // end expand

function update(source) {

  // Compute the new tree layout.
  var nodes = tree.nodes(root).reverse(),
      links = tree.links(nodes);

  // Normalize for fixed-depth.
  nodes.forEach(function(d) { d.y = d.depth * 40; });

  // Update the nodes...
  var node = svg.selectAll("g.node")
      .data(nodes, function(d) { return d.id || (d.id = ++i); });

  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + source.x0 + "," + source.y0 + ")"; })
      .on("click", function(d) {
        if(d.data) console.log(d.name + ":", d.data)
      })
      .on("dblclick", collapseNode);

  nodeEnter.append("circle")
      .attr("r", 1e-6)
      .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; })
      .style("stroke", "lightsteelblue");

  nodeEnter.append("text")
      .attr("y", function(d) { return d.children || d._children ? -12 : 12; })
      .attr("dy", ".35em")
      .attr("class", "text")
      .attr("text-anchor", "middle")
      .text(function(d) { 
        if(d.content != undefined) return d.content;
        if(d.type != undefined) return d.type;
        else return d.name; 
      })
      .style("fill-opacity", 1e-6)
      .style("font-size", "8pt")
      .style("user-select", "none");

  // Transition nodes to their new position.
  var nodeUpdate;
  if(init) {
    nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  } else {
    nodeUpdate = node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  }

  nodeUpdate.select("circle")
      .attr("r", 4.5)
      .style("stroke", function(d) {
        if(d.data && d.oldData) {
          var somethingChanged = false;
          Object.keys(d.data).forEach(function(key) {
            if(d.data[key] != d.oldData[key]) somethingChanged = true;
          })
          if(somethingChanged) {
            d.myColor = "red";
            return "red";
          }
        }
        return d.myColor || "lightsteelblue";
      })
      .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

  nodeUpdate.select("text")
      .style("fill-opacity", 1);

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + source.x + "," + source.y + ")"; })
      .remove();

  nodeExit.select("circle")
      .attr("r", 1e-6);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);

  // Update the links...
  var link = svg.selectAll("path.link")
      .data(links, function(d) { return d.target.id; });

  // Enter any new links at the parent's previous position.
  link.enter().insert("path", "g")
      .attr("class", "link")
      .style("stroke", "lightgray")
      .style("stroke-opacity", 0.5)
      .style("fill", "none")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      });

  // Transition links to their new position.
  if(init) {
    link.transition()
      .duration(duration)
      .attr("d", diagonal);
  } else {
    link.attr("d", diagonal);
    init = true;
  }

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });
} // end update

// Toggle children.
function collapseNode(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
  update(d);
} // end collapseNode

function toggle() {
  //TODO: figure out why it shows two nodes, but lets you collapse 
  //      the first one thus breaking everything
  var button = d3.select("#btn_scene_show")[0][0];
  if(button.value == "Hide All") {
    button.value = "Show All";
    root.children.forEach(collapse);
    update(root)
  } else {
    button.value = "Hide All";
    root.children.forEach(expand);
    update(root)
  }
} // end toggle