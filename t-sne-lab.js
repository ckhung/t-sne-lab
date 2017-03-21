/* global window, console, d3, alert, $, tsnejs, md5 */
// https://stackoverflow.com/questions/11957977/how-to-fix-foo-is-not-defined-error-reported-by-jslint

var G = { // global variables
  configFN: 'config.json',
  catf: {},	// names of categorical fields
  scale: {},
  setIntervalID: null
};

d3.json(G.configFN, function(data) {
  console.log(data);
  G.config = {
    batch: 100,
    interval: 300,
    transition: 300
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
	numbers.push(+d[k]);
      } else {
	var fn = k.substring(1);
	d[fn] = d[k];
	G.catf[fn] = 1;
      }
      delete d[k];
    });
    d.numbers = numbers;
  });
  G.data = G.data.filter(function (d, i) {
    for (var j=0; j<d.numbers.length; ++j) {
      if (isNaN(d.numbers[j])) {
	console.log('ignoring row ' + i + ' [labeled:' + d.label + '] because feature ' + j + ' is NaN');
	return false;
      }
    }
    return true;
  });
  G.raw = G.data.map(function(d) { return d.numbers; });
  $('#show-dataset').text(G.config.csvFN);

  var t = '';
  for (var f in G.catf) {
    t += '<option value="' + f + '">' + f + '</option>\n';
  }
  $('#choose-label').html(t)
    .change(function() {
      var labelFN = $('#choose-label').val();
      G.canvas.selectAll('.item-text')
	.text(function(d) { return d[labelFN]; });
      changePalette();
    });
  $('#choose-title').html(t)
    .change(function() {
      var titleFN = $('#choose-title').val();
      G.canvas.selectAll('.item-tooltip')
	.text(function(d) { return d[titleFN]; });
    });
  $('#choose-font-size').change(function() {
    var labelSize = $('#choose-font-size').val();
    G.canvas.selectAll('.item-text')
      .style('font-size', function(d) { return labelSize; });
  });
  $('#choose-palette').change(changePalette);

  function changePalette() {
    var labelFN = $('#choose-label').val();
    var palette = parseInt($('input[name=palette]:checked').val());
    G.canvas.selectAll('.item-icon')
      .style('fill', function(d) {
        var r = md5(d[labelFN]);
        // https://github.com/blueimp/JavaScript-MD5
        return '#' + (r + r).substring(palette, palette+3);
      });
  }

  var i, j;
  t = '';
  for (i=0; i<4; ++i) {
    t += '<tr>\n';
    for (j=0; j<8; ++j) {
      var s = '<td><input id="pal-#" type="radio" name="palette"' +
	'value="#" /><label for="pal-#" width="100%">#</label></td>\n';
      t += s.replace(/#/g, (i*8+j).toString());
    }
    t += '</tr>\n';
  }
  $('#choose-palette').append(t);
  $('#pal-0').attr('checked', 1);

  // https://github.com/d3/d3-zoom
  // https://stackoverflow.com/questions/16265123/resize-svg-when-window-is-resized-in-d3-js (responsive svg)

  // https://stackoverflow.com/questions/38534500/d3-js-rewriting-zoom-example-in-version4
  // https://bl.ocks.org/mbostock/4e3925cdc804db257a86fdef3a032a45
  // NOTE: create rect before other elements,
  // or else other elements (e.g. svg:title) will not receive mouse events!
  G.svg = d3.select('#rsvg-box svg');
  var VB = G.svg.attr('viewBox').split(' ').map(parseFloat);
  G.viewBox = { width: VB[2], height: VB[3] };
  G.svg
    .append('rect')
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
  G.canvas = G.svg.append('g')
    .attr('id', 't-sne-canvas');

  G.items = G.canvas
    .selectAll('.item')
    .data(G.data)
    .enter()
    .append('g');
  G.items.append('circle')
    .classed('item-icon', true)
    // initially put everything at the center
    // regardless of its value
    .attr('cx', G.viewBox.width/2)
    .attr('cy', G.viewBox.height/2)
    .attr('r', 10)
    .style('fill', '#088');
  G.items.append('text')
    .classed('item-text', true)
    .attr('dy', '0.7ex');
    // https://stackoverflow.com/questions/19127035/what-is-the-difference-between-svgs-x-and-dx-attribute
    // dy can't be set using CSS.
  G.items.append('svg:title')
    .classed('item-tooltip', true);
}

function restart() {
  if (G.setIntervalID) {
    window.clearInterval(G.setIntervalID);
    G.setIntervalID = null;
  }
  G.tsne = new tsnejs.tSNE(G.config.tsne);
  G.tsne.initDataRaw(G.raw);
  G.iteration = 0;
  pauseResume();
}

function pauseResume() {
  if (G.setIntervalID) {
    window.clearInterval(G.setIntervalID);
    G.setIntervalID = null;
  } else {
    G.setIntervalID = window.setInterval(function() { update(G.config.batch); }, G.config.interval);
  }
}

function update(n) {
  for ( ; n>0; --n) {
    G.cost = G.tsne.step();
    ++G.iteration;
  }
  var s = G.tsne.getSolution();
  var sx = s.map( function(d) { return d[0]; } );
  var sy = s.map( function(d) { return d[1]; } );
  G.scale.x = d3.scaleLinear()
    .domain([d3.min(sx), d3.max(sx)])
    .range([100, 700]);
  G.scale.y = d3.scaleLinear()
    .domain([d3.min(sy), d3.max(sy)])
    .range([75, 525]);
  for (var i=0; i<s.length; ++i) {
    G.data[i].xpos = G.scale.x(sx[i]);
    G.data[i].ypos = G.scale.y(sy[i]);
  }
  // https://stackoverflow.com/questions/596351/how-can-i-know-which-radio-button-is-selected-via-jquery
  G.canvas.selectAll('.item-icon')
    .transition()
    .duration(G.config.transition)
    .attr('cx', function(d) { return d.xpos; })
    .attr('cy', function(d) { return d.ypos; });
  G.canvas.selectAll('.item-text')
    .transition()
    .duration(G.config.transition)
    .attr('x', function(d) { return d.xpos; })
    .attr('y', function(d) { return d.ypos; });
  $('#show-iter').text(G.iteration);
  $('#show-cost').text(Math.round(G.cost*100)/100);
}

