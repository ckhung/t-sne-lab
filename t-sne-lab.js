/* global window, console, d3, alert, $, tsnejs */
// https://stackoverflow.com/questions/11957977/how-to-fix-foo-is-not-defined-error-reported-by-jslint

var G = { // global variables
  configFN: 'config.json'
};

d3.json(G.configFN, function(data) {
  console.log(data);
  G.config = {
    csvFN: 'NBA-zh_TW.csv'
  };
  $.extend(true, G.config, data);
  loadCSV(G.config.csvFN);
});

function loadCSV(fn) {
  d3.queue()
    .defer(d3.csv, fn)
    .awaitAll(init);
}

function init(error, data) {
  if (error) { return console.warn(error); }
  G.data = data[0];
  G.data.forEach(function(d){
    var numbers = [];
    Object.keys(d).sort().forEach(function(k){
      if (k.charAt(0) != '@') {
	numbers.push(d[k]);
      } else {
	d[k.substring(1)] = d[k];
      }
      delete d[k];
    });
    d.numbers = numbers;
  });

  // https://github.com/d3/d3-zoom
  // https://stackoverflow.com/questions/16265123/resize-svg-when-window-is-resized-in-d3-js (responsive svg)
  G.svg = d3.select('#rsvg-box svg');
  var VB = G.svg.attr('viewBox').split(' ').map(parseFloat);
  G.viewBox = { width: VB[2], height: VB[3] };

  G.svg.append('g')
    .attr('id', 't-sne-canvas');
  G.canvas = d3.select('#t-sne-canvas');
  // note: to ensure the correct z-index,
  // the rect for zooming must not be
  // a child of G.vanvas . See
  // https://github.com/d3/d3/issues/252
  G.svg.append('rect')
    .attr('width', G.viewBox.width)
    .attr('height', G.viewBox.height)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .call(d3.zoom()
      .scaleExtent([1e-1, 1e2])
      .on('zoom', function() {
	G.canvas.attr('transform', d3.event.transform);
      })
    );

  G.data.forEach(function(d) {
    d.cx = d.numbers[0];
    d.cy = d.numbers[1];
  });
  G.items = G.canvas
    .selectAll('.item')
    .data(G.data)
    .enter()
    .append('g');
  G.items.append('circle')
    .attr('cx', function(d) { return d.cx; })
    .attr('cy', function(d) { return d.cy; })
    .attr('r', 10)
    .attr('opacity', 0.5)
    .style('fill', function(d) { return d.color; });
  G.items.append('text')
    .text('hello')
    .attr('font-size', '12px')
    .attr('dy', '1ex')
    .attr('fill', '#000');

//  var tsne = new tsnejs.tSNE(G.config.tsne);
}

