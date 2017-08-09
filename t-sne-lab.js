/* global window, console, location, d3, alert, $, tsnejs, md5 */
// https://stackoverflow.com/questions/11957977/how-to-fix-foo-is-not-defined-error-reported-by-jslint

var G = { // global variables
  configFN: 'config.json',
  scale: {},
  setIntervalID: null
};

// https://stackoverflow.com/questions/2618959/not-well-formed-warning-when-loading-client-side-json-in-firefox-via-jquery-aj
$.ajaxSetup({ beforeSend: function(xhr){
  xhr.overrideMimeType('application/json');
}});

var configFN = $.url(location.href).param('config');
if (! configFN) { configFN = 'config.json'; }
$.getJSON(configFN).done(function(data) {
  G.config = {
    batch: 10,
    interval: 30,
    transition: 300,
    labelF: [],
    ignoreF: [],
    numberF: [],
    tsne: {
      epsilon: 10,
      perplexity: 30,
    }
  };
  $.extend(true, G.config, data);
  console.log(G.config);
  d3.queue()
    .defer(d3.csv, G.config.csvFN)
    .awaitAll(init);
}).fail(function( jqxhr, textStatus, error ) {
  var msg = 'failed reading config file "' + configFN + '"';
  alert(msg);
  throw new Error(msg);
});

function init(error, data) {
  if (error) {
    var msg = 'failed reading csv file "' + G.config.csvFN + '"';
    alert(msg);
    throw new Error(msg);
  }
  G.data = data[0];
  G.data.keys = d3.keys(G.data[0]);
  G.data.keys.forEach(function(k){
//    if (k.charAt(0) == '@')
//      G.config.labelF.push(k);
    if (G.config.labelF.indexOf(k) < 0 && G.config.ignoreF.indexOf(k) < 0) {
      G.config.numberF.push(k);
    }
  });
  G.config.numberF = G.config.numberF.sort();
  var lf0 = G.config.labelF[0];
  G.data = G.data.filter(function (d, i) {
    var rn = (i+1).toString();
    for (var j = 0; j < G.config.numberF.length; ++j) {
      var f = G.config.numberF[j];
      if (isNaN(d[f])) {
        if (d[lf0] === null) {
          console.log('ignoring row ' + rn + ' as an empty line');
        } else {
	  console.log('ignoring row ' + rn + ' [ data[' +
            lf0 + ']==' + d[lf0] + ' ] because data[' +
            d[f] + '] is NaN');
        }
	return false;
      }
    }
    return true;
  });
  G.raw = G.data.map(function(d) {
    return G.config.numberF.map(function(f) { return parseFloat(d[f]); });
  });
  $('#pause-resume').prop('disabled', true);
  $('#show-dataset').text(G.config.csvFN);
  $('#batch-size').val(G.config.batch);
  $('#perplexity').val(G.config.tsne.perplexity);
  $('#epsilon').val(G.config.tsne.epsilon);

  var t = '';
  G.config.labelF.forEach(function (f) {
    t += '<option value="' + f + '">' + f + '</option>\n';
  });
  $('#color-field').html(t).change(changePalette);
  $('#label-field').html(t).change(changeText);
  $('#choose-font-size').change(changeFontSize);
  $('#choose-palette').change(changePalette);
  $('#batch-size').change(function() {
    G.config.batch = $('#batch-size').val();
  });
  $('#perplexity').change(function() {
    G.config.tsne.perplexity = $('#perplexity').val();
    restart();
  });
  $('#epsilon').change(function() {
    G.config.tsne.epsilon = $('#epsilon').val();
  });

  var i, j;
  t = '';
  for (i=0; i<5; ++i) {
    t += '<tr>\n';
    for (j=0; j<8; ++j) {
      var s = '<td><input id="pal-@" type="radio" name="palette"' +
	'value="@" /><label for="pal-@" width="100%">@</label></td>\n';
      t += s.replace(/@/g, (100+i*8+j).toString().substr(1));
    }
    t += '</tr>\n';
  }
  $('#choose-palette').append(t);
  var colors, cell;
  colors = [
    '#555555', '#ff5555', '#55ff55', '#ffff55',
    '#5555ff', '#ff55ff', '#55ffff'
  ];
  for (j=0; j<7; ++j) {
    cell = $('#pal-'+(32+j).toString()+' + label');
    cell.css('background-color', colors[j]);
  }
  cell = $('#pal-39 + label');
  cell.text('');
  cell.append('<img src="icon-image.png" width=80% />');
  $('#pal-00').attr('checked', 1);
  $('#show-lf').click(textOnOff);

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
    .attr('r', 10);
  G.items.append('text')
    .classed('item-label', true)
    .attr('x', G.viewBox.width/2)
    .attr('y', G.viewBox.height/2)
    .attr('dy', '0.7ex');
    // https://stackoverflow.com/questions/19127035/what-is-the-difference-between-svgs-x-and-dx-attribute
    // dy can't be set using CSS.
  changeText();
  changeFontSize();
  changePalette();
}

function restart() {
  if (G.setIntervalID) {
    window.clearInterval(G.setIntervalID);
    G.setIntervalID = null;
  }
  G.tsne = new tsnejs.tSNE(G.config.tsne);
  G.tsne.initDataRaw(G.raw);
  G.iteration = 0;
  $('#pause-resume').prop('disabled', false);
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
  G.canvas.selectAll('.item-label')
    .transition()
    .duration(G.config.transition)
    .attr('x', function(d) { return d.xpos; })
    .attr('y', function(d) { return d.ypos; });
  $('#show-iter').text(G.iteration);
  $('#show-cost').text(Math.round(G.cost*100)/100);
}

function changePalette() {
  var colorFN = $('#color-field').val();
  var palette = parseInt($('input[name=palette]:checked').val());
  if (palette < 39) {
    var fixed;
    if (palette >= 32) {
      fixed = $('#pal-'+palette.toString()+' + label').css('background-color');
    }
    G.canvas.selectAll('.item-icon')
      .style('fill', palette>=32 ? fixed : function(d) {
        var r = md5(d[colorFN]);
        // https://github.com/blueimp/JavaScript-MD5
        return '#' + (r + r).substring(palette, palette+3);
      });
  } else {
    alert('not implemented yet');
  }
}

function textOnOff() {
  var showTF = $('#show-lf').text();
  if (showTF.match(/✓ *$/)) {
    $('#label-field').prop('disabled', true );
    $('#show-lf').text('label field');
  } else {
    $('#label-field').prop('disabled', false );
    $('#show-lf').text('label field ✓');
  }
  changeText();
}

function changeText() {
  var textFN = $('#label-field').val();
  var showTF = ! $('#label-field').prop('disabled');
  G.canvas.selectAll('.item-label')
    .text(function(d) { return showTF ? d[textFN] : ''; });
}

function changeFontSize() {
  var labelSize = $('#choose-font-size').val();
  G.canvas.selectAll('.item-label')
    .style('font-size', function(d) { return labelSize; });
}

