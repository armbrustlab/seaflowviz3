$(function () {
  Highcharts.setOptions({
    tooltip: {
      valueDecimals: 2
    },
    loading: {
      style: {
        backgroundColor: 'silver'
      },
      labelStyle: {
        color: "white",
        font: "16px helvetica, sans-serif"
      }
    },
    credits: {
      enabled: false
    }
  });

  chart.par = makeParChart("PAR", "PAR (w/m2)",
                           [{name: "PAR", data: []}], "par");
  chart.temp = makeLineChart("Temperature", "Temp (degC)",
                             [{name: "Temperature", data: []}], "temp");
  chart.salinity = makeLineChart("Salinity", "Salinity (psu)",
                                 [{name: "Salinity", data: []}], "salinity");
  var emptyAbundanceSeries = [];
  var emptyFscSmallSeries = [];
  popLabels.forEach(function(pop) {
    emptyAbundanceSeries.push({name: pop, data: []});
    emptyFscSmallSeries.push({name: pop, data: []});
  });
  chart.abundance = makeLineChart("Abundance", "Abundance (10^6 cells/L)",
                                  emptyAbundanceSeries, "abundance", true);
  chart.fsc_small = makeLineChart("Forward Scatter", "Forward scatter (a.u.)",
                                  emptyFscSmallSeries, "size", true);
  getSflData(function(data) {
    addToSingleSeries(chart.par, data, "par");
    addToSingleSeries(chart.temp, data, "temp");
    addToSingleSeries(chart.salinity, data, "salinity");
  });
  getStatData(function(data) {
    addToPopSeries(chart.abundance, data, "abundance");
    addToPopSeries(chart.fsc_small, data, "fsc_small");
  });
});

// Short names for populations in database
var popNames = ["prochloro", "synecho", "picoeuk", "beads"];
// Full names for legend
var popLabels = ["Prochlorococcus", "Synechococcus", "Picoeukaryotes", "Beads"];
// Lookup table between pop database shortnames / object keys and common names
var popLookup = {};
for (var i = 0; i < popNames.length; i++) {
  popLookup[popNames[i]] = popLabels[i];
  popLookup[popLabels[i]] = popNames[i];
}
// ISO String of most recent SFL date received
var lastSflISO = null, lastStatISO = null, lastCstarISO = null;
var chart = Object.create(null);


function makeParChart(title, yAxisTitle, series, divId) {
  var c = Highcharts.StockChart({
    chart: {
      renderTo: divId
    },
    legend: {
      enabled: false
    },
    rangeSelector: {
      enabled: false
    },
    plotOptions: {
      series: {
        gapSize: 2
      }
    },
    title: {
      text: title
    },
    xAxis: {
      type: "datetime",
      events: {
        setExtremes: throttledcb(function(e) {
          setExtremes(e.min, e.max);
        }, 250)
      }
    },
    yAxis: {
      title: {
        text: yAxisTitle
      }
    },
    series: series
  });
  c.showLoading();
  return c;
}

function makeLineChart(title, yAxisTitle, series, divId, showLegend) {
  var c = new Highcharts.StockChart({
    chart: {
      renderTo: divId
    },
    legend: {
      enabled: showLegend
    },
    navigator: {
      enabled: false
    },
    rangeSelector: {
      enabled: false
    },
    scrollbar: {
      enabled: false
    },
    plotOptions: {
      series: {
        events: {
          click: function(e) {
            console.log(e.point);
            removePoint(e.point);
          }
        }
      },
      gapSize: 2
    },
    title: {
      text: title
    },
    xAxis: {
      type: "datetime"
    },
    yAxis: {
      title: {
        text: yAxisTitle
      }
    },
    series: series
  });
  c.showLoading();
  return c;
}

function setExtremes(min, max) {
  ["temp", "salinity", "abundance", "fsc_small"].forEach(function(c) {
    if (chart[c]) {
      chart[c].xAxis[0].setExtremes(min, max);
    }
  });
}

function addToSingleSeries(chart, data, key) {
  data.forEach(function(d) {
    chart.series[0].addPoint([d.date, d[key]], false);
  });
  chart.hideLoading();
  chart.redraw();
}

function addToPopSeries(chart, data, key) {
  var series = {};
  chart.series.forEach(function(s) {
    if (popLookup[s.name]) {
      // Check if series pop name is valid to avoid adding to navigator
      // series if it exists
      series[s.name] = s; // lookup table by series name
    }
  });
  Object.keys(data).forEach(function(pop) {
    data[pop].forEach(function(d) {
      series[pop].addPoint([d.date, d[key]], false);
    });
  });
  chart.hideLoading();
  chart.redraw();
}

// Remove a single point. If this point represents grouped data remove all
// points in underlying raw series data, series.xData.
function removePoint(point) {
  var points = findPoints(point), i;


  // Series reference may disappear after point removal so save here
  var series = point.series,
    xData = point.series.xData;
  console.log(xData.length);
  for (i=0; i<points.length; i++) {
    var removed = new Date(xData[points[0]]).toISOString();
    console.log("removed " + removed);
    series.removePoint(points[0], true);
  }
  series.chart.redraw();
  console.log(xData.length);
}

// Return an array of indexes for points corresponding to this point in raw
// series data, series.xData. This point may be a single point representing one
// item in series.xData, or it may represent grouped data for many points in
// series.xData.
function findPoints(point) {
  var points = [], i;
  if (! point.series.hasGroupedData) {
    for (i=0; i<point.series.xData.length; i++) {
      if (point.series.xData[i] === point.x) {
        points.push(i);
        break;
      }
    }
  } else {
    var end = point.x + (point.series.currentDataGrouping.count - 1) *
              point.series.currentDataGrouping.unitRange;
    for (i=0; i<point.series.xData.length; i++) {
      if (point.series.xData[i] >= point.x && point.series.xData[i] <= end) {
        points.push(i);
      }
    }
  }
  return points;
}

function getSflData(cb) {
  var query = "SELECT * ";
  query += "FROM [seaflow.viz@gmail.com].[SeaFlow Sfl Data] ";
  query += "ORDER BY [time] ASC";
  executeSqlQuery(query, function(jsonp) {
    var data = transformData(jsonp, sqlshareSflHandler);
    cb(data);
  });
}

function getStatData(cb) {
  var query = "SELECT * ";
  query += "FROM [seaflow.viz@gmail.com].[SeaFlow Pop Data] ";
  query += "ORDER BY [time] ASC";
  executeSqlQuery(query, function(jsonp) {
    var data = transformData(jsonp, sqlshareStatHandler);
    cb(data);
  });
}

// Turn jsonp data from SQL share query result into an arrays of JSON objects
// that can be easily fed to crossfilter/dc.js
function transformData(jsonp, sqlshareRecordHandler) {
  if (jsonp.header.length < 2) {
    alert('Query ' + data.sql + ' returned ' + jsonp.header.length +
          ' columns, needs at least 2');
    return;
  }

  // Figure out which columns correspond to which column headers
  idx = Object.create(null);
  for (var col = 0; col < jsonp.header.length; col++) {
    idx[jsonp.header[col]] = col;
  }
  var data = [];    // environmental data
  jsonp.data.forEach(function(d) {
    sqlshareRecordHandler(d, idx, data);
  });
  return data;
}

function sqlshareSflHandler(d, idx, data) {
  var curTime = Date.parse(d[idx.time]);
  data.push({
    date: curTime,
    lat: d[idx.lat],
    lon: d[idx.lon],
    temp: d[idx.ocean_tmp],
    salinity: d[idx.salinity],
    par: Math.max(d[idx.par], 0)
  });
}

function sqlshareStatHandler(d, idx, data) {
  var curTime = Date.parse(d[idx.time]);
  popLabels.forEach(function(pop) {
    if (data[pop] === undefined) {
      data[pop] = [];
    }
    data[pop].push({
      date: curTime,
      fsc_small: d[idx[popLookup[pop] + "_size"]],
      abundance: d[idx[popLookup[pop] + "_conc"]]
    });
  });
}

function executeSqlQuery(query, cb) {
  var url = 'https://rest.sqlshare.escience.washington.edu/REST.svc/execute?sql=';
  var t0 = new Date();
  $.ajax({
    url : url + encodeURIComponent(query),
    dataType : 'jsonp',
    type : 'GET',
    jsonp : 'jsonp',
    crossDomain : 'true',
    error : function(xhr, ts, et) {
      alert("error errorThrow:" + et);
    },
    success : function(jsonp) {
      console.log("SQL query took " +
                  (((new Date().getTime()) - t0.getTime())/1000) + " sec");
      cb(jsonp);
    }
  });
}

// Closure to throttle a callback, cb, attached to frequently firing events
// which may be expensive to run, e.g. plot redraws based on user input. cb will
// only run after no further calls to cb are made for delay milliseconds. If a
// different callback needs to be run every time the event fires this can be
// optionally provided as the third parameter.
function throttledcb(cb, delay, every) {
  var counter = 0;
  var inner = function() {
    var args = arguments;
    if (every) {
      every.apply(every, args);
    }
    var myNumber = ++counter;
    setTimeout(function() {
      if (myNumber == counter) {
        cb.apply(cb, args);
        counter = 0;
      }
    }, delay);
  };
  return inner;
}
