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

var oldData, newData, treeData, root, rootNode, tree, svg, diagonal;
var aggregateChange, numDescendants;
var margin, width, height;

var ved, padding;

var color = d3.scale.ordinal()
    .range(["white", "#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", 
            "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704"])
    .domain([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);

/*************************************************************/
/*************************** Flags ***************************/
/*************************************************************/
var init = false;
var showAxis = true;
var showLegend = true;
var ignoreDiff = false;
var inspection = false;

/*************************************************************/
/************************* Constants *************************/
/*************************************************************/
var AUTO_COLLAPSE_THREASHOLD = 7;
var DELAY = 1000;
var TRANSITION_DELAY = 400;
var i = 0;
var duration = 750;

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

// TODO: Make it so that a diff is NOT computed when the user
//       changes the specification via dropdown. (NOTE: this
//       functionality is interesting when the user just
//       modifies and parses the specification.)

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
  if(!inspection) {
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
  }
} // end updateScenegraph

function sceneInit(context) {
  ved = context;
  padding = ved.view.model()._defs.padding;
  ved.view._handler.on("click", function(evt) { 
    if(inspection) {
      var x = evt.layerX - padding.left;
      var y = evt.layerY - padding.top;
      var point = new vg.Bounds().set(x, y, x, y)
      newData.forEach(function(node) {
        node.userSelect = null;
        // TODO: This bound calculation is not quite working. The
        //       bounds of various objects are often placed within
        //       the context of their parents. The primary (broken)
        //       example of this is the x-axis; the bounds of the
        //       x-axis stretch from y = 199 to 222 BUT each of the
        //       internal text marks has a y-bounds like 11 to 22.
        //       Basically, this is 11 from the top of the axis
        //       bounds. Therefore, when the check below is trying
        //       to determine containment it fails because the
        //       point is not compared in the same CONTEXT.
        // TODO: Is the bound of a child ALWAYS based on the bounds
        //       of the parent? If so, incorporate that assumption
        //       into this bounds calculation.
        if(node.bounds && node.bounds.encloses(point)) {
          node.userSelect = true;
        }
      });
      init = false;
      computeTreeStructure(newData);
      update(root);
    }
  });

  extractScenegraph(ved.root);
} // end sceneInit

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
 * GROUP: <name>, <parent>, <type>, <bounds>
 * ITEM:  <name>, <parent>, <data>, <bounds>
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
                 "bounds": currentNode.bounds};
      nodes.push(obj);
      nodesToCheck = nodesToCheck.concat(currentNode.items);
    
    // If the CURRENT node is an ITEM.
    } else {
      var obj = {"name": getID(currentNode),
                 "parent": getID(currentNode.mark),
                 "data": getDataObj(currentNode),
                 "bounds": currentNode.bounds};
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

function computeDescendants(data) {
  var numChildren = {};
  numDescendants = {};

  // Create a map of the number of children for each node.
  data.forEach(function(node) {
    numChildren[node.parent] = (numChildren[node.parent] + 1) || 1;
  });

  // Aggregate counts to determine the number of descendants.
  Object.keys(numChildren).forEach(function(key) {
    var levels = key.split(".");
    var currentKey = levels[0];
    for (var i = 1; i <= levels.length; i++) {
      numDescendants[currentKey] = numDescendants[currentKey] + numChildren[key] || numChildren[key] || 0;
      currentKey += "." + levels[i];
    };
  });
} // end computeDescendants

function getNodeSize(d) {
  // TODO: fine-tune this more.
  if(d._children) {
    var num = numDescendants[d.name];
    if(num >= AUTO_COLLAPSE_THREASHOLD * 8) return 7.5;
    if(num >= AUTO_COLLAPSE_THREASHOLD * 4) return 6.5;
    if(num >= AUTO_COLLAPSE_THREASHOLD * 2) return 5.5;
    return 4.5;
  }
  return 3.5;
} // getNodeSize

function getColorValue(d) {
  // If the input node is collapsed, aggregate the amount of
  // change for all internal nodes. Otherwise, the fill color
  // should be white.
  if(d.collapsed != undefined && d.collapsed) {
    if(aggregateChange[d.name] == undefined) return 0;
    if(numDescendants[d.name] == undefined) return 90; // All descendants were removed.
    var percentage = Math.ceil((aggregateChange[d.name] / numDescendants[d.name])*10)*10;
    if(percentage >= 100) return 90; // Everything over 90 should have the darkest color.
    return percentage;
  } else {
    return 0;
  }
} // end getColorValue

function dataChanged(oldDataObj, newDataObj) {
  var somethingChanged = false;
  // TODO: see if we can break out of this loop early.
  // TODO: if the element is an object, need to recursively
  //       check it. can probably just use this function?
  Object.keys(newDataObj).forEach(function(key) {
    if(newDataObj[key] != oldDataObj[key]) {
      somethingChanged = true;
    }
  });
  return somethingChanged;
} // end dataChanged

function processDiff() {
  // Record the number of children that change (are modified
  // in some way) for each parent.
  var map = {};

  // For all the new data, determine if updated or added.
  newData.forEach(function(node) {
    var matchingNodes = oldData.filter(function(oldNode) {
      if(oldNode.name == node.name) return oldNode;
    });

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
    if(node.status != "none") {
      map[node.parent] = (map[node.parent] + 1) || 1;
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
      map[oldNode.parent] = (map[oldNode.parent] + 1) || 1;
    }
  });

  // Compute the "amount" of change for each node based on the
  // children of the node.
  aggregateChange = {};
  Object.keys(map).forEach(function(key) {
    var levels = key.split(".");
    var currentKey = levels[0];
    for (var i = 1; i <= levels.length; i++) {
      aggregateChange[currentKey] = aggregateChange[currentKey] + map[key] || map[key] || 0;
      currentKey += "." + levels[i];
    };
  });
} // end processDiff

function computeTreeStructure(newData) {
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

  root = treeData[0];
  root.x0 = 0;
  root.y0 = height / 2;
} // end computeTreeStructure

// BASED ON: http://www.d3noob.org/2014/01/tree-diagrams-in-d3js_11.html
//           http://bl.ocks.org/mbostock/4339083
function drawGraph(nodes) {
  // Preprocess the data.
  newData = nodes.slice(0);
  computeDescendants(newData);
  if(oldData && !ignoreDiff) processDiff();
  if(ignoreDiff) maintainCollapse();

  margin = {top: 20, right: 05, bottom: 20, left: 05};
  width = d3.select("#vis")[0][0].offsetWidth - margin.right - margin.left;
  height = 800 - margin.top - margin.bottom;
    
  tree = d3.layout.tree()
      .size([width, height]);

  diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.x, d.y]; });

  svg = d3.select("#scenegraph").append("svg")
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  computeTreeStructure(newData);
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
        //if(d.data) console.log(d.name + ":", d.data)
        if (d.bounds) console.log(d.name + ":", d.bounds)
        else console.log(d.name)
      })
      .on("click", toggle);

  nodeEnter.append("circle")
      .attr("r", 1e-6);
      //.style("fill", function(d) { return d._children ? "#fff" : "#fff"; })
      //.style("stroke", "lightsteelblue")
      //.style("stroke-width", function(d) { return d._children ? 0.5 : 1; });

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
      .delay(TRANSITION_DELAY)
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  } else {
    nodeUpdate = node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  }

  nodeUpdate.select("circle")
      .attr("r", getNodeSize)
      .style("stroke", function(d) {
        if(d.status == "added") return "limegreen";
        if(d.status == "removed") return "red";
        if(d.status == "updated") return "orange";
        if(d._children) return "black";
        return "lightsteelblue";
      })
      .style("stroke-width", function(d) { return d._children ? 1.5 : 1; })
      .style("fill", function(d) { 
        if(d.userSelect) {
          return "pink"
        }
        if(aggregateChange) {
          return color(getColorValue(d));
        }
        return color(0);
      });

  nodeUpdate.select("text")
      .style("fill-opacity", 1);

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .delay(TRANSITION_DELAY)
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
      .delay(TRANSITION_DELAY)
      .duration(duration)
      .attr("d", diagonal);
  } else {
    link.attr("d", diagonal);
    init = true;
  }

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .delay(TRANSITION_DELAY)
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

// TODO: figure out how to support transitions
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
  update(root);
} // end toggleAxis

// TODO: figure out how to support transitions
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

function inspect() {
  // TODO: when switching states, redraw graph to remove past
  //       highlighting. Also, maintain collapse depth.
  if(inspection) {
    d3.select("#btn_scene_inspect")[0][0].value = "Inspect";
    inspection = false;
  } else {
    // TODO: disable end-user interaction (i.e. the brush example
    //       still lets you brush the points in the vis when in
    //       the inspect format, but we want to prevent this from
    //       happening so that the user can inspect things like
    //       the brush itself.)
    // TODO: remove transition when interacting in the inspect mode
    // TODO: maintain the collapse depth in the inspect mode.
    d3.select("#btn_scene_inspect")[0][0].value = "Interact";
    inspection = true;
  }
} // end inspect
