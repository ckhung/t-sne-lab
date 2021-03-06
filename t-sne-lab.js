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
    labelCol: [],
    ignoreCol: [],
    numberCol: [],
    pic: {
      colName: null,
      prefix: '',
      suffix: '',
      width: '',
      height: '',
    },
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
    if (!k || k.match(/^\s*$/)) {
      var msg = 'Unexpected empty column name in header (1st) row.\n' +
	'Are there two consecutive commas (,,)\n' +
	'or a redundant comma at the end? Please fix.';
      alert(msg);
      throw new Error(msg);
    }
    if (G.config.labelCol.indexOf(k) < 0 && G.config.ignoreCol.indexOf(k) < 0) {
      G.config.numberCol.push(k);
    }
  });
  G.config.numberCol = G.config.numberCol.sort();
  var lf0 = G.config.labelCol[0];
  G.data = G.data.filter(function (d, i) {
    var rn = (i+1).toString();
    for (var j = 0; j < G.config.numberCol.length; ++j) {
      var f = G.config.numberCol[j];
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
    return G.config.numberCol.map(function(f) { return parseFloat(d[f]); });
  });
  $('#pause-resume').prop('disabled', true);
  $('#show-dataset').text(G.config.csvFN);
  $('#choose-font-size').val(12);
  $('#batch-size').val(G.config.batch);
  $('#perplexity').val(G.config.tsne.perplexity);
  $('#epsilon').val(G.config.tsne.epsilon);

  var t = '';
  G.config.labelCol.forEach(function (f) {
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
    monoColor(32+j, colors[j]);
  }
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
    .append('g')
    .classed('item', true)
    // initially put everything at the center
    // regardless of its value
    .attr('transform',
      'translate('+G.viewBox.width/2+','+G.viewBox.height/2+')');
  G.items.append('circle')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 10);
  cell = $('#pal-39 + label');
  if (G.config.pic.colName) {
    cell.text('');
    cell.append('<img src="icon-image.png" width=70% />');
    var pic = G.config.pic;
    G.items.append('svg:image')
      .classed('item-pic', true)
      .attr('x', -pic.width/2)
      .attr('y', -pic.height/2)
      .attr('width', pic.width)
      .attr('height', pic.height)
      .attr('xlink:href', function(d) {
	return pic.prefix + d[pic.colName] + pic.suffix;
    });
    $('#pal-39').attr('checked', 1);
  } else {
    cell.text('X');
    $('#pal-39').attr('disabled',true);
  }
  G.items.append('text')
    .attr('x', 0)
    .attr('y', 0)
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
  G.items = G.canvas.selectAll('.item').attr('transform',
    'translate('+G.viewBox.width/2+','+G.viewBox.height/2+')');
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
  G.canvas.selectAll('.item')
    .transition()
    .duration(G.config.transition)
    .attr('transform', function(d) {
      return 'translate(' + d.xpos + ',' + d.ypos + ')';
    });
  $('#show-iter').text(G.iteration);
  $('#show-cost').text(Math.round(G.cost*100)/100);
}

function changePalette() {
  var colorFN = $('#color-field').val();
  var palette = parseInt($('input[name=palette]:checked').val());
  if (palette < 39) {
    var fixed;
    if (palette >= 32) { fixed = monoColor(palette); }
    G.canvas.selectAll('.item circle')
      .style('fill', palette>=32 ? fixed : function(d) {
        var r = md5(d[colorFN]);
        // https://github.com/blueimp/JavaScript-MD5
        return '#' + (r + r).substring(palette, palette+3);
      });
    if (G.config.pic.colName) {
      G.canvas.selectAll('.item-pic').style('visibility', 'hidden');
      G.canvas.selectAll('.item circle').style('visibility', 'visible');
      G.canvas.selectAll('.item text').attr('y', 0);
    }
  } else {
    G.canvas.selectAll('.item circle').style('visibility', 'hidden');
    G.canvas.selectAll('.item-pic').style('visibility', 'visible');
    var fs = parseFloat($('#choose-font-size').val());
    G.canvas.selectAll('.item text').attr('y', G.config.pic.height*0.5+fs*0.5);
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
  G.canvas.selectAll('.item text')
    .text(function(d) { return showTF ? d[textFN] : ''; });
}

function changeFontSize() {
  var labelSize = $('#choose-font-size').val() + 'px';
  G.canvas.selectAll('.item text')
    .style('font-size', function(d) { return labelSize; });
}

function monoColor(id, co) {
  var cell = $('#pal-'+(id).toString()).parent();
  if (co) {
    cell.css('background-color', co);
  } else {
    return cell.css('background-color');
  }
}
