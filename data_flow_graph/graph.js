d3.json("autoD3.json", function(err, json) {
    var nodes = json.nodes;
    var edges = json.edges;
    //drawGraph(nodes, edges);
});

function drawGraph(nodes, edges) {

  var width = 20000,
      height = 2000;

  var force = d3.layout.force()
      .charge(-120)
      .linkDistance(30)
      .size([width, height]);

  var svg = d3.select("#graph").append("svg")
      .attr("width", width)
      .attr("height", height);

  //var color = d3.scale.category20();
  var color = d3.scale.ordinal()
    .domain(["Node", "Signal", "Data Source Input", "Data Source Output", "Collector", "Scale", "Group Builder", "Builder", "Bounder"])
    .range(["gray", "#2ca02c", "#e7ba52", "#e7ba52", "#ffbb78", "#1f77b4", "#d62728", "#ff9896", "#ff7f0e", "purple"]);

  // Manually create connections between edges and nodes
  // because the default does so by index, whereas I want
  // to use the name
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

  force
    .nodes(nodes)
    .links(edges);

  var factor = 50;
  var factory = 1250;
  var factorx = 200;

  var link = svg.selectAll(".link")
      .data(edges)
    .enter().append("line")
      .attr("class", "link")
      .attr("stroke", "#999")
      .style("stroke-width", "3px")
      .attr("x1", function(d) { return d.source.x * factor + factorx; })
      .attr("y1", function(d) { return height - d.source.y * factor - factory; })
      .attr("x2", function(d) { return d.target.x * factor + factorx; })
      .attr("y2", function(d) { return height - d.target.y * factor - factory; });

  var node = svg.selectAll(".node")
      .data(nodes)
    .enter().append("circle")
      .attr("class", "node")
      .attr("r", 15)
      .style("fill", function(d) { 
        return color(d.type); 
      })
      .attr("cx", function(d) { return d.x * factor + factorx; })
      .attr("cy", function(d) { return height - d.y * factor - factory; })
    .on("click", function(d) {
      console.log("Node " + d.name + " def: ", d.def);
    });

  var text = svg.selectAll("text")
      .data(force.nodes())
      .enter().append("text")
      .attr("class", "text")
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text(function(d) { return d.title; })
      .attr("transform", function(d) { return "translate(" + (d.x * factor + factorx) + "," + (height - d.y * factor - factory) + ")"; });

  var legendRectSize = 25;
  var legendSpacing = 25;
  var offset = -50
  var legend = svg.selectAll('.legend')
      .data(color.domain())
      .enter()
      .append('g')
      .attr('class', 'legend')
      .attr('transform', function(d, i) {
        var h = legendRectSize + legendSpacing;
        //var offset =  h * color.domain().length / 2;
        var horz = 2 * legendRectSize;
        var vert = i * h - offset;
        return 'translate(' + horz + ',' + vert + ')';
      });

  legend.append('rect')
      .attr('width', legendRectSize)
      .attr('height', legendRectSize)
      .style('fill', color)
      .style('stroke', color);

  legend.append('text')
      .attr('x', legendRectSize + legendSpacing)
      .attr('y', legendRectSize - legendSpacing - (offset / 3))
      .text(function(d) { return d; });

  /*force.on("tick", function() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });

    text.attr("transform", function(d) { 
      return "translate(" + d.x + "," + d.y + ")";
    });

  });*/

}