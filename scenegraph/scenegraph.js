/*************************************************************/
/************************ Global Data ************************/
/*************************************************************/
var timer; // Responsible for throttling the udpate.
var context, handlers;

// Data
var newData, oldData, treeData, root;
var numDescendants, aggregateChange;

// Visualized Scenegraph
var svg;
var width, height;
var tree;

/*************************************************************/
/*************************** Flags ***************************/
/*************************************************************/
var showAxis = true;
var showLegend = true;
var inspection = false;
var initialized = false;

/*************************************************************/
/************************* Constants *************************/
/*************************************************************/
var AUTO_COLLAPSE_THREASHOLD = 7;
var DELAY = 1000;
var TRANSITION_DELAY = 400;
var TRANSITION_DURATION = 750;
var i = 0; // TODO: figure out if this is used.

var margin = {top: 20, right: 05, bottom: 20, left: 05};
var diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.x, d.y]; });

var color = d3.scale.ordinal()
    .range(["white", "#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", 
            "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704", 
            "black"])
    .domain([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

/*************************************************************/
/*************************************************************/

// TODO: only call this function when switching the spec
//       via dropdown (or the first time the scenegraph
//       is constructed)
function initialize(ved) {
  //TODO: reset flags

  // Extract the data from the scenegraph.
  context = ved;
  extractScenegraph(context.root);
  computeDescendants();
  computeTreeStructure();
  // Draw the scenegraph.
  drawScenegraph();
  initialized = false;
} // end initialize

function update(node) {
  // Extract the new data from the scenegraph.
  saveOldData();
  extractScenegraph(node);
  computeDescendants();
  // Compare the new data to the old data and compute the diff.
  processDiff();
  // Maintain the collapse level of the scenegraph
  maintainCollapse();
  // Draw the scenegraph
  computeTreeStructure();
  drawScenegraph();
} // end update

function redraw(node) {
  // Extract the new data from the scenegraph.
  saveOldData();
  extractScenegraph(node);
  computeDescendants();
  // Maintain the collapse level of the scenegraph
  maintainCollapse();
  // Draw the scenegraph
  computeTreeStructure();
  drawScenegraph();
} // end redraw

function updateInspection(node) {
  // Extract the new data from the scenegraph.
  saveOldData();
  newData = oldData.slice(0);
  //extractScenegraph(node);
  //computeDescendants();
  // Maintain the collapse level of the scenegraph.
  maintainCollapse();
  // Draw the scenegraph
  computeTreeStructure();
  drawScenegraph();
  // Disable end-user interaction
} // end updateInspection

/*************************************************************/
/******************** Get Scenegraph Data ********************/
/*************************************************************/

// TODO: figure out if this needs to do anything else.
function saveOldData() {
  oldData = newData;
  newData = null
} // saveOldData

// The scenegraph tree is created in a deterministic manner, so
// this ID function uses the nested index of the nodes as the
// unique ID of the node.
function getID(node) {
  var parentID = "", nodeIndex = "";
  if(node.marktype != undefined && !node.group) {
    // The node is a root node.
    return "0";
  } else if(node.marktype != undefined && node.group) {
    // The node is a GROUP mark.
    parentID = getID(node.group);
    if(node.group.items.indexOf(node) != -1) {
      // The node exists in the parent's list of items.
      myIndex = node.group.items.indexOf(node) + "i";
    } else if(node.group.axisItems.indexOf(node) != -1) {
      // The node exists in the parent's list of axis items.
      myIndex = node.group.axisItems.indexOf(node) + "a";
    } else if(node.group.legendItems.indexOf(node) != -1) {
      // The node exists in the parent's list of legend items.
      myIndex = node.group.legendItems.indexOf(node) + "l";
    } else {
      myIndex = "NaN";
    }
  } else if(node.mark) {
    // The node is an ITEM.
    parentID = getID(node.mark);
    myIndex = node.mark.items.indexOf(node);
  }
  return parentID + "." + myIndex;
} // end getID

function getDataObj(node) {
  // Save relevant data for the scenegraph
  var dataObj = {};
  // TODO: figure out a better strategy for saving relevant information
  if(node.text != undefined) {
    dataObj["text"] = node.text;
  }
  if(node.key != undefined) {
    dataObj["key"] = node.key;
  }
  if(node.fill != undefined) {
    dataObj["fill"] = node.fill;
  }
  if(node.fillOpacity != undefined) {
    dataObj["fillOpacity"] = node.fillOpacity;
  }
  if(node.stroke != undefined) {
    dataObj["stroke"] = node.stroke;
  }
  if(node.size != undefined) {
    dataObj["size"] = node.size;
  }
  if(node.width != undefined) {
    dataObj["width"] = node.width;
  }
  if(node.height != undefined) {
    dataObj["height"] = node.height;
  }
  if(node.dx != undefined) {
    dataObj["dx"] = node.dx;
  }
  if(node.x != undefined) {
    dataObj["x"] = node.x;
  }
  if(node.x2 != undefined) {
    dataObj["x2"] = node.x2;
  }
  if(node.dy != undefined) {
    dataObj["dy"] = node.dy;
  }
  if(node.y != undefined) {
    dataObj["y"] = node.y;
  }
  if(node.y2 != undefined) {
    dataObj["y2"] = node.y2;
  }
  if(node.datum != undefined) {
    dataObj["datum"] = node.datum;
  }
  return dataObj;
} // end getDataObj

/* Convert the input scenegraph node into a list of nodes with
 * the following data attributes. Save the data as newData.
 * GROUP: <name>, <parent>, <type>, <bounds>
 * ITEM:  <name>, <parent>, <data>, <bounds>
 */
function extractScenegraph(node) {
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

  newData = nodes.slice(0); // TODO: figure out if slice is necessary.
} // end extractScenegraph

function numChildren(d) {
  if(!d.children) return 0;
  var leaves = d.children.filter(function(child) {
    if(!child.children || child.children.length == 0) return child;
  });
  return leaves.length;
} // end numChildren

function computeDescendants() {
  var numChildren = {};
  numDescendants = {};

  // Create a map of the number of children for each node.
  // Note: This does NOT include nodes that have a "removed" status.
  newData.forEach(function(node) {
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

function computeTreeStructure() {
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
} // end computeTreeStructure

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
      node.status = "updated";
    } else {
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

function dataChanged(oldDataObj, newDataObj) {
  var somethingChanged = false;
  // TODO: see if we can break out of this loop early.
  // TODO: if the element is an object, need to recursively
  //       check it. can probably just use this function?
  Object.keys(newDataObj).forEach(function(key) {
    if(newDataObj[key] instanceof Object &&
       dataChanged(newDataObj[key], oldDataObj[key])) {
      somethingChanged = true;
    } else if(newDataObj[key] != oldDataObj[key]) {
      somethingChanged = true;
    }
  });
  return somethingChanged;
} // end dataChanged

/*************************************************************/
/********************** Draw Scenegraph **********************/
/*************************************************************/
function updateTreeSize() {
  width = d3.select("#vis")[0][0].offsetWidth - margin.right - margin.left;
  height = 800 - margin.top - margin.bottom; // TODO: don't hard code this.

  tree = d3.layout.tree()
      .size([width, height]);

  d3.select("#theScenegraph").remove();
  svg = d3.select("#scenegraph").append("svg")
      .attr("id", "theScenegraph")
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  root.x0 = 0;
  root.y0 = height / 2;
} // end updateTreeSize

function drawScenegraph() {
  updateTreeSize();
  partialCollapse(root);

  // Compute the new tree layout.
  var nodes = tree.nodes(root).reverse(),
      links = tree.links(nodes);
  nodes.forEach(function(d) { d.y = d.depth * 40; }); // Normalize for fixed-depth.
  
  // Update the nodes...
  var node = svg.selectAll("g.node")
      .data(nodes, function(d) { return d.id || (d.id = ++i); });
  // Update the links...
  var link = svg.selectAll("path.link")
      .data(links, function(d) { return d.target.id; });

  drawNodes(node);
  drawEdges(link);
  drawLegend();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });
} // end drawScenegraph

function drawNodes(node) {
  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { 
        return "translate(" + root.x0 + "," + root.y0 + ")";
        //return "translate(" + source.x0 + "," + source.y0 + ")"; 
      })
      .on("dblclick", function(d) {
        // TODO: this isn't working anymore?
        if(d.data) console.log(d.name + " data:", d.data)
        if (d.bounds) console.log(d.name + " bounds:", d.bounds)
        else console.log(d.name)
      })
      .on("click", toggle);

  nodeEnter.append("circle")
      .attr("r", 1e-6);

  // Node Labels
  nodeEnter.append("text")
      .attr("y", function(d) { return d.children || d._children ? -12 : 12; })
      .attr("dy", ".35em")
      .attr("class", "text")
      .attr("text-anchor", "middle")
      .text(function(d) { 
        if(d.type != undefined) return d.type;
      })
      .style("fill-opacity", 1e-6)
      .style("font-size", "8pt")
      .style("user-select", "none");

  // Transition nodes to their new position.
  var nodeUpdate;
  if(initialized) {
    // Only transition nodes if the tree has been initialized.
    nodeUpdate = node.transition()
      .delay(TRANSITION_DELAY)
      .duration(TRANSITION_DURATION)
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
          return "pink";
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
      .duration(TRANSITION_DURATION)
      .attr("transform", function(d) { 
        return "translate(" + root.x + "," + root.y + ")";
        //return "translate(" + source.x + "," + source.y + ")";
      })
      .remove();

  nodeExit.select("circle")
      .attr("r", 1e-6);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);
} // end drawNodes

function drawEdges(link) {
  // Enter any new links at the parent's previous position.
  link.enter().insert("path", "g")
      .attr("class", "link")
      .style("stroke", "lightgray")
      .style("stroke-opacity", 0.5)
      .style("fill", "none")
      .attr("d", function(d) {
        var o = {x:root.x0, y:root.y0};
        //var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      });

  // Transition links to their new position.
  if(initialized) {
    // Only transition links if the graph has been initialized.
    link.transition()
        .delay(TRANSITION_DELAY)
        .duration(TRANSITION_DURATION)
        .attr("d", diagonal);
  } else {
    link.attr("d", diagonal);
  }

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .delay(TRANSITION_DELAY)
      .duration(TRANSITION_DURATION)
      .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();
} // end drawEdges

function drawLegend() {
  var legendRectSize = 10;
  var legendSpacing = 2;

  // TODO: appending legend to the scenegraph, is that what we want?
  var caption = d3.select("#scenegraph").select("svg").append("g")
      .attr("transform", "translate(5,30)")
      .style("position", "relative");

  var legend = caption.selectAll(".legend")
      .data(color.domain())
    .enter()
      .append("g")
      .attr("class", "legend")
      .attr("transform", function(d, i) {
        var height = legendRectSize + legendSpacing;
        var vert = -1.5 * legendRectSize;
        var horz = i * height;
        return 'translate(' + horz + ',' + vert + ')';
      });

  legend.append("rect")
      .attr("width", legendRectSize)
      .attr("height", legendRectSize)
      .style("fill", color)
      .style("stroke", color);

  legend.append("text")
      //.attr('x', legendRectSize / 2 - 2 * legendSpacing)
      .attr("y", 2 * legendRectSize)
      .text(function(d) { 
        return d;
      })
      .style("text-anchor", "center")
      .style("font-size", "6pt")
      .style("fill", "lightgray");
} // end drawLegend

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
  var maxColor = color.domain()[color.domain().length - 1];
  if(d.collapsed != undefined && d.collapsed) {
    if(aggregateChange[d.name] == undefined) return 0;
    if(numDescendants[d.name] == undefined) return maxColor; // All descendants were removed.
    var percentage = Math.ceil((aggregateChange[d.name] / numDescendants[d.name])*10)*10;
    if(percentage >= 100) return maxColor;
    return percentage;
  } else {
    return 0;
  }
} // end getColorValue

/*************************************************************/
/********************** Show/Hide Nodes **********************/
/*************************************************************/
function toggle(d) {
  // Print relevant node information
  if(d.data) console.log(d.name + " data:", d.data)
  if (d.bounds) console.log(d.name + " bounds:", d.bounds)
  else console.log(d.name)

  // Toggle collapsed status of node.
  if (d.children) collapse(d);
  else expand(d);
  drawScenegraph(); // TODO: reincorporate source?
} // end toggle

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
/*************************************************************/

// Reset delay each time debounce is called to prevent the scenegraph
// from updating. Once the delay is completed without interruption,
// fullfill the update!
// BASED ON: https://remysharp.com/2010/07/21/throttling-function-calls
function debounce(fn, node, delay) {
  return function () {
    clearTimeout(timer);
    timer = setTimeout(function () { fn(node); }, delay);
  };
} // end debounce

function fullfillUpdate(node) {
  d3.select("#invalidRect").remove();
  update(node);
} // end fullfillUpdate

function updateScenegraph() {
  // TODO: remove hard coding.
  if(!inspection) {
    // Draw a rectangle to gray out the scenegraph to denote
    // that it is no longer up-to-date.
    d3.select("#invalidRect").remove();
    svg.append("rect")
        .attr("id", "invalidRect")
        .attr("x", -50)
        .attr("y", -100)
        .attr("width", d3.select("#theScenegraph")[0][0].offsetWidth * 1.5)  
        .attr("height", d3.select("#theScenegraph")[0][0].offsetHeight)
        .style("fill", "#FBFBFB")
        .style("fill-opacity", 0.75);

    // Debounce the fullfillUpdate.
    debounce(fullfillUpdate, this, DELAY)();
  }
} // end updateScenegraph

function enableInspection() {
  console.log(context)
  var padding = context.view.model()._defs.padding;
  // TODO: when padding is auto, not sure how to resolve the
  //       position of the point.
  context.view._handler.on("click", function(evt) { 
    if(inspection) {
      console.log("Inspecting element at point(", evt.layerX, ",", evt.layerY, ")")
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
      updateInspection(context.root);
    }
  });
} // end enableInspection

/*************************************************************/
/********************** IDE Interaction **********************/
/*************************************************************/

// Show all nodes from button click.
function showAll() {
  expandAll(root);
  drawScenegraph();
} // end showAll

function autoCollapse() {
  expandAll(root);
  resetCollapsed(root);
  partialCollapse(root);
  drawScenegraph();
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
  redraw(context.root);
  drawScenegraph();
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
  redraw(context.root);
} // end toggleAxis

function inspect() {
  if(inspection) {
    d3.select("#btn_scene_inspect")[0][0].value = "Inspect";
    inspection = false;
    update(context.root);
    context.view._handler._handlers = handlers;
  } else {
    // TODO: remove transition when interacting in the inspect mode
    d3.select("#btn_scene_inspect")[0][0].value = "Interact";
    inspection = true;

    console.log("Handlers:", context.view._handler._handlers)
    handlers = context.view._handler._handlers;
    context.view._handler._handlers = {};
    enableInspection(); 
    update(context.root);
       
  }
} // end inspect
