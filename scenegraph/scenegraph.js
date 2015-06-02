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
 *
 */

var oldData, newData, treeData, i, duration, root, rootNode, tree, svg, diagonal;
var margin, width, height;

/*************************************************************/
/*************************** Flags ***************************/
/*************************************************************/
var init = false;
var showAxis = true;
var showLegend = true;
var ignoreDiff = false;

/*************************************************************/
/************************* Constants *************************/
/*************************************************************/
var AUTO_COLLAPSE_THREASHOLD = 7;
var DELAY = 500;

/*************************************************************/
/**************** End-User Scenegraph Update *****************/
/*************************************************************/

// TODO: The scenegraph is still updated when the user has
//       NOT done an interaction (i.e. if the user just moves
//       the mouse around the brush example without brushing).
//       This functionality will cause the scenegraph to
//       remove potentially interesting information (i.e. to
//       update the scenegraph more than we want it to). For
//       example, if the user completes an interaction, then
//       waits for the scenegraph to update, and then goes to
//       interact with the scenegraph, it will then update
//       again to remove the interesting highlighting.

// BASED ON: https://remysharp.com/2010/07/21/throttling-function-calls
// Reset delay each time debounce is called to prevent update.
var timer = null;
function debounce(fn, node, delay) {
  return function () {
    clearTimeout(timer);
    timer = setTimeout(function () { fn(node); }, delay);
  };
} // end debounce

// Remove the old scenegraph and create a new one.
function fullfillUpdate(node) {
  console.log("Update scenegraph.");
  d3.select("#scenegraph").selectAll("*").remove();
  extractScenegraph(node);
} // end fullfillUpdate

// Wait until DELAY has passed without end-user interaction 
// before updating the scenegraph.
function updateScenegraph() {
  // TODO: remove hard coding.
  d3.select("#scenegraph").selectAll("rect").remove();
  var rectWidth = d3.select("#scenegraph")[0][0].offsetWidth;
  var rectHeight = d3.select("#scenegraph")[0][0].offsetHeight;
  svg.append("rect")
      .attr("x", -50)
      .attr("y", -100)
      .attr("width", rectWidth + 50)  
      .attr("height", rectHeight + 100)
      .style("fill", "#FBFBFB")
      .style("fill-opacity", 0.75);

  debounce(fullfillUpdate, this, DELAY)();
} // end updateScenegraph

/*************************************************************/
/******************** Extract Scenegraph *********************/
/*************************************************************/

// The scenegraph tree is created in a deterministic manner, so
// this ID function uses the nested index of the nodes as the
// unique ID of the node.
function getID(node) {
  var id = "";
  // If the CURRENT node is a GROUP mark.
  if(node.marktype != undefined) {
    if(node.group) {
      var parentID = getID(node.group);
      var myIndex;
      if(node.group.items.indexOf(node) != -1) {
        myIndex = node.group.items.indexOf(node) + "i";
      } else {
        myIndex = node.group.axisItems.indexOf(node) + "a";
      }
      id = parentID + "." + myIndex;
    } else {
      // It is the root node.
      id = "0";
    }

  // If the CURRENT node is an ITEM.
  } else {
    if(node.mark) {
      var parentID = getID(node.mark);
      var myIndex = node.mark.items.indexOf(node);
      id = parentID + "." + myIndex;
    }
  }
  return id;
} // end getID

function getDataObj(currentNode) {
  // Save relevant data for the scenegraph
  var dataObj = {};
  // TODO: figure out a better strategy for saving relevant information
  if(currentNode.text != undefined) {
    dataObj["text"] = currentNode.text;
  }
  if(currentNode.key != undefined) {
    dataObj["key"] = currentNode.key;
  }
  if(currentNode.fill != undefined) {
    dataObj["fill"] = currentNode.fill;
  }
  if(currentNode.fillOpacity != undefined) {
    dataObj["fillOpacity"] = currentNode.fillOpacity;
  }
  if(currentNode.stroke != undefined) {
    dataObj["stroke"] = currentNode.stroke;
  }
  if(currentNode.size != undefined) {
    dataObj["size"] = currentNode.size;
  }
  if(currentNode.width != undefined) {
    dataObj["width"] = currentNode.width;
  }
  if(currentNode.height != undefined) {
    dataObj["height"] = currentNode.height;
  }
  if(currentNode.dx != undefined) {
    dataObj["dx"] = currentNode.dx;
  }
  if(currentNode.x != undefined) {
    dataObj["x"] = currentNode.x;
  }
  if(currentNode.x2 != undefined) {
    dataObj["x2"] = currentNode.x2;
  }
  if(currentNode.dy != undefined) {
    dataObj["dy"] = currentNode.dy;
  }
  if(currentNode.y != undefined) {
    dataObj["y"] = currentNode.y;
  }
  if(currentNode.y2 != undefined) {
    dataObj["y2"] = currentNode.y2;
  }
  if(currentNode.datum != undefined) {
    dataObj["datum"] = currentNode.datum;
  }
  return dataObj;
} // end getDataObj

/*
 * There are two types of nodes in the scenegraph, Group marks and Items.
 * GROUP: <name>, <parent>, <type>, <data>
 * ITEM:  <name>, <parent>, <data> 
 */
function extractScenegraph(node) {
  // Save the old data.
  if(newData) {
    oldData = newData;
    newData = null;
  }
  init = false;
  rootNode = node;

  // Save information about root node and prepare for tree traversal
  var nodes = [];
  nodes.push({"name": getID(node), "type": node.marktype, "parent": "null"});
  var nodesToCheck = node.items.slice(0);

  // Traverse scenegraph until all nodes have been reached
  while(nodesToCheck.length != 0) {
    var currentNode = nodesToCheck.pop();
    
    // If the CURRENT node is a GROUP mark.
    if(currentNode.marktype != undefined) {
      var obj = {"name": getID(currentNode), 
                 "parent": getID(currentNode.group),
                 "type": currentNode.marktype,
                 "data": currentNode.bounds};
      nodes.push(obj);
      nodesToCheck = nodesToCheck.concat(currentNode.items);
    
    // If the CURRENT node is an ITEM.
    } else {
      var obj = {"name": getID(currentNode),
                 "parent": getID(currentNode.mark),
                 "data": getDataObj(currentNode)};
      nodes.push(obj);

      if(showAxis && currentNode.axisItems != undefined && currentNode.axisItems.length != 0) {
        nodesToCheck = nodesToCheck.concat(currentNode.axisItems);
      }
      if(showLegend && currentNode.legendItems != undefined && currentNode.legendItems.length != 0) {
        nodesToCheck = nodesToCheck.concat(currentNode.legendItems);
      }
      if(currentNode.items != undefined && currentNode.items.length != 0) {
        nodesToCheck = nodesToCheck.concat(currentNode.items);
      }
    }
  } // end while

  drawGraph(nodes);
} // end extractScenegraph

/*************************************************************/
/********************** Draw Scenegraph **********************/
/*************************************************************/

function dataChanged(oldDataObj, newDataObj) {
  var somethingChanged = false;
  //TODO: see if we can break out of this loop early.
  Object.keys(newDataObj).forEach(function(key) {
    if(newDataObj[key] != oldDataObj[key]) somethingChanged = true;
  });
  return somethingChanged;
} // end dataChanged

function maintainCollapse() {
  newData.forEach(function(node) {
    var matchingNodes = oldData.filter(function(oldNode) {
      if(oldNode.name == node.name) return oldNode;
    });
    if(matchingNodes.length && matchingNodes[0].collapsed != undefined) {
      node.collapsed = matchingNodes[0].collapsed;
    }
  });
} // end maintainCollapse

function processDiff() {
  // For all the new data, determine if updated or added.
  newData.forEach(function(node) {
    var matchingNodes = oldData.filter(function(oldNode) {
      if(oldNode.name == node.name) return oldNode;
    });

    // We would expect the oldData to only have ONE node with
    // the same name as the input node (i.e. name should be unique)
    if(matchingNodes.length > 1) {
      console.log("ERROR: Multiple children");
      console.log(matchingNodes);
    }
    if(matchingNodes.length == 0) {
      node.status = "added";
    } else if(matchingNodes[0].status && matchingNodes[0].status == "removed") {
      // Last time, the node had been removed, so now it has been re-added.
      node.status = "added";
    } else if(matchingNodes[0].data && dataChanged(matchingNodes[0].data, node.data)) {
      if(matchingNodes[0].collapsed != undefined) {
        node.collapsed = matchingNodes[0].collapsed;
      }
      node.status = "updated";
    } else {
      if(matchingNodes[0].collapsed != undefined) {
        node.collapsed = matchingNodes[0].collapsed;
      }
      node.status = "none";
    }
  });

  // For all the old data, determine if any nodes were removed.
  oldData.forEach(function(oldNode) {
    var newNode = newData.filter(function(d) {
      if(d.name == oldNode.name) return d;
    });
    if(newNode.length == 0 && (!oldNode.status || oldNode.status != "removed")) {
      oldNode.status = "removed";
      newData.push(oldNode);
    }
  });
} // end processDiff

// BASED ON: http://www.d3noob.org/2014/01/tree-diagrams-in-d3js_11.html
//           http://bl.ocks.org/mbostock/4339083
function drawGraph(nodes) {
  // Preprocess the data.
  newData = nodes.slice(0);
  if(oldData && !ignoreDiff) processDiff();
  if(ignoreDiff) maintainCollapse();

  // Structure the nodes appropriately.
  var data = JSON.parse(JSON.stringify(newData)); // Copies the object.
  var dataMap = data.reduce(function(map, node) {
    map[node.name] = node;
    return map;
  }, {});

  treeData = [];
  data.forEach(function(node) {
    var parent = dataMap[node.parent];
    if (parent) {
      (parent.children || (parent.children = [])).push(node);
    } else {
      treeData.push(node);
    }
  });

  margin = {top: 20, right: 05, bottom: 20, left: 05};
  width = d3.select("#vis")[0][0].offsetWidth - margin.right - margin.left;
  height = 800 - margin.top - margin.bottom;
    
  i = 0;
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

  root = treeData[0];
  root.x0 = 0;
  root.y0 = height / 2;

  partialCollapse(root);
  update(root);

  d3.select(self.frameElement).style("height", "800px");
} // end drawGraph

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
      .on("dblclick", function(d) {
        // TODO: figure out how to disable this for double click.
        if(d.data) console.log(d.name + ":", d.data)
        else console.log(d.name)
      })
      .on("click", toggle);

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
        if(d.status == "added") return "limegreen";
        if(d.status == "removed") return "red";
        if(d.status == "updated") return "orange";
        return "lightsteelblue";
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

/*************************************************************/
/********************** Show/Hide Nodes **********************/
/*************************************************************/

function numChildren(d) {
  if(!d.children) return 0;
  var leaves = d.children.filter(function(child) {
    if(!child.children || child.children.length == 0) return child;
  });
  return leaves.length;
} // end numChildren

// TODO: update functionality to look for repeated patterns in the
//       structure of the scenegraph and collapse regularly repeated
//       structures (e.g. scatterplot matrix)
function partialCollapse(d) {
  if(d.collapsed != undefined && d.collapsed) {
      collapse(d);
  } else if(d.collapsed != undefined && !d.collapsed) {
    expand(d);
    if(d.children) d.children.forEach(partialCollapse);
  } else if(numChildren(d) >= AUTO_COLLAPSE_THREASHOLD) {
    collapse(d);
  } else {
    expand(d);
    if(d.children) d.children.forEach(partialCollapse);
  }
} // end partialCollapse

// Hide the children of the input node.
function collapse(d) {
  setCollapsed(d, true);
  if(d.children) {
    d._children = d.children;
    d.children = null;
  }
} // end collapse

// Unhide the children of the input node.
function expand(d) {
  setCollapsed(d, false);
  if(d._children) {
    d.children = d._children;
    d._children = null;
  }
} // end expand

// Unhide the children of the input node and all grandchildren.
function expandAll(d) {
  if(d._children) expand(d);
  if(d.children) d.children.forEach(expandAll);
} // end expandAll

// Toggle collapsed status of node.
function toggle(d) {
  if (d.children) collapse(d);
  else expand(d);
  update(d);
} // end toggle

function setCollapsed(d, collapsed) {
  d.collapsed = collapsed;
  newData.forEach(function(node) {
    if(node.name == d.name) node.collapsed = collapsed;
  });
} // end setCollapsed

function resetCollapsed(node) {
  setCollapsed(node, null);
  if(node.children) node.children.forEach(resetCollapsed);
  if(node._children) node._children.forEach(resetCollapsed);
} // end resetCollapsed

/*************************************************************/
/********************** IDE Interaction **********************/
/*************************************************************/

// Hide or show all nodes from button click.
function showAll() {
  expandAll(root);
  update(root);
} // end showAll

function autoCollapse() {
  expandAll(root);
  resetCollapsed(root);
  partialCollapse(root);
  update(root);
} // end autoCollapse

function toggleAxis() {
  var button = d3.select("#btn_scene_toggleAxis")[0][0];
  if(button.value == "Remove Axis") {
    button.value = "Show Axis";
    showAxis = false;
  } else {
    button.value = "Remove Axis";
    showAxis = true;
  }
  ignoreDiff = true;
  fullfillUpdate(rootNode);
  ignoreDiff = false;
} // end toggleAxis

function toggleLegend() {
  var button = d3.select("#btn_scene_toggleLegend")[0][0];
  if(button.value == "Remove Legend") {
    button.value = "Show Legend";
    showLegend = false;
  } else {
    button.value = "Remove Legend";
    showLegend = true;
  }
  ignoreDiff = true;
  fullfillUpdate(rootNode);
  ignoreDiff = false;
} // end toggleAxis
