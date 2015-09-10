$(function () {
  Highcharts.setOptions({
    loading: {
      style: {
        backgroundColor: 'silver'
      },
      labelStyle: {
        color: "white",
        font: "16px helvetica, sans-serif"
      }
    },
    plotOptions: {
      series: {
        events: {
          click: function(e) {
            removePoint(e.point);
          }
        },
        cursor: "pointer"
      }
    },
    title: {
      margin: 0
    },
    credits: {
      enabled: false
    },
    tooltip: {
      valueDecimals: 2,
      hideDelay: 100
    },
    chart: {
      plotBorderWidth: 2,
      spacingBottom: 3
    },
    yAxis: {
      floor: 0
    }
  });

  // Make empty charts
  chart.ts = make2AxisLineChart(null, ["Salinity (psu)", "Temp (degC)"],
                                [{name: "Temperature", data: []},
                                 {name: "Salinity", yAxis: 1, data: []}],
                                "ts", false, false, false);
  chart.speed = makeLineChart(null, "Speed (knots)",
                              [{name: "Speed", data: []}], "speed", false,
                              false, false);
  chart.fsc_small = makeLineChart(null, "Forward scatter (a.u.)",
                                  makeEmptyPopSeries(), "size", true, false,
                                  false);
  chart.abundance = makeLineChart(null, "Abundance (10^6 cells/L)",
                                  makeEmptyPopSeries(), "abundance", true,
                                  true, true);
  getSflData(function(data) {
    addToSingleSeries(chart.ts, data, "salinity", "Salinity");
    addToSingleSeries(chart.ts, data, "temp", "Temperature");
    addSpeed(chart.speed, data, sfl);
    addToNavigatorSeries(chart.abundance, data, "par");
    addXPlotBands(chart.ts.xAxis[0], data, "par");
    addXPlotBands(chart.fsc_small.xAxis[0], data, "par");
    addXPlotBands(chart.abundance.xAxis[0], data, "par");
    getStatData(function(data) {
      addToPopSeries(chart.fsc_small, data, "fsc_small");
      addToPopSeries(chart.abundance, data, "abundance");
    });
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
var lastISO = null;
var chart = Object.create(null);
var sfl = [];

function makeLineChart(title, yAxisTitle, series, divId, showLegend, showNav,
                       showXAxis) {
  var nav = {
    enabled: false
  };
  if (showNav) {
    nav = {
      enabled: true,
      adaptToUpdatedData: false,
      series: {
        data: []
      }
    };
  }
  var xAxis = {
    type: "datetime",
    events: {
      setExtremes: throttledcb(function(e) {
        setExtremes(e.min, e.max);
      }, 250)
    }
  };
  if (! showXAxis) {
    xAxis.labels = { enabled: false };
    xAxis.lineWidth = 0;
    xAxis.lineColor = "transparent";
    xAxis.tickLength = 0;
    xAxis.minorTickLength = 0;
  }

  var c = new Highcharts.StockChart({
    chart: {
      renderTo: divId
    },
    legend: {
      enabled: showLegend
    },
    navigator: nav,
    rangeSelector: {
      enabled: false
    },
    title: {
      text: title,
    },
    xAxis: xAxis,
    yAxis: {
      title: {
        text: yAxisTitle
      }
    },
    scrollbar: {
      enabled: false
    },
    series: series
  });
  c.showLoading();
  return c;
}

function make2AxisLineChart(title, yAxisTitles, series, divId, showLegend,
                            showNav, showXAxis) {
  var nav = {
    enabled: false
  };
  if (showNav) {
    nav = {
      enabled: true,
      adaptToUpdatedData: false,
      series: {
        data: []
      }
    };
  }
  var xAxis = {
    type: "datetime"
  };
  if (! showXAxis) {
    xAxis.labels = { enabled: false };
    xAxis.lineWidth = 0;
    xAxis.lineColor = "transparent";
    xAxis.tickLength = 0;
    xAxis.minorTickLength = 0;
  }

  var c = new Highcharts.StockChart({
    chart: {
      renderTo: divId,
      events: {
        load: function(e) {
          for (var i=0; i<2; i++) {
            this.yAxis[i].update({
              title: {
                style : {
                  "color": this.series[i].color
                }
              },
              labels: {
                style: {
                  "color": this.series[i].color
                }
              }
            }, false);
          }
        }
      }
    },
    legend: {
      enabled: showLegend
    },
    navigator: nav,
    rangeSelector: {
      enabled: false
    },
    title: {
      text: title,
    },
    xAxis: xAxis,
    yAxis: [
      {
        title: {
          text: yAxisTitles[0]
        },
      },
      {
        title: {
          text: yAxisTitles[1]
        },
        gridLineWidth: 0,
        opposite: false,
        labels: {
          align: "left",
          x: 0
        }
      }
    ],
    scrollbar: {
      enabled: false
    },
    series: series
  });
  c.showLoading();
  return c;
}

function makeEmptyPopSeries() {
  var series = [],
      legendIndex = 0;
  popLabels.forEach(function(pop) {
    series.push({name: pop, data: [], legendIndex: legendIndex});
    legendIndex++;
  });
  return series;
}

function setExtremes(min, max) {
  ["speed", "ts", "fsc_small"].forEach(function(c) {
    if (chart[c]) {
      chart[c].xAxis[0].setExtremes(min, max);
    }
  });
}

function addSpeed(chart, data, sfl) {
  var last = null;
  data.forEach(function(d) {
    if (sfl.length) {
      last = sfl[sfl.length-1];
      d.speed = geo2knots([last.lon, last.lat], [d.lon, d.lat],
                          new Date(last.date), new Date(d.date));
      chart.series[0].addPoint([d.date, d.speed], false);
    }
    sfl.push(d);
  });
  chart.hideLoading();
  chart.redraw();
}

function addToSingleSeries(chart, data, key, seriesName) {
  var series = chart.series[0];
  if (seriesName) {
    chart.series.forEach(function(s) {
      if (s.name === seriesName) {
        series = s;
      }
    });
  }
  data.forEach(function(d) {
    series.addPoint([d.date, d[key]], false);
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

function addXPlotBands(axis, data, key) {
  var xvals = data.map(function(d) { return d.date; }),
      yvals = data.map(function(d) { return d[key]; });
  var spans = lowSpans(xvals, yvals, 0.01);
  spans.forEach(function(s) {
    axis.addPlotBand({
      color: "rgba(0, 0, 0, 0.1)",
      from: s[0],
      to: s[1]
    });
  });
}

function addToNavigatorSeries(chart, data, key) {
  var nav = getNavigator(chart);
  if (nav) {
    data.forEach(function(d) {
      nav.addPoint([d.date, d[key]], false);
    });
  }
  chart.redraw();
}

function getNavigator(chart) {
  var nav = null;
  chart.series.forEach(function(s) {
    if (s.name === "Navigator") {
      nav = s;
    }
  });
  return nav;
}

// Return an array of [start, stop] x positions corresponding to runs of values
// in y < cutoff.
function lowSpans(xvals, yvals, cutoff) {
  var spans = [],
      start = null;

  for (var i=0; i<xvals.length; i++) {
    if (yvals[i] < cutoff) {
      if (start === null) {
        start = xvals[i];
      }
    } else {
      if (start !== null) {
        spans.push([start, xvals[i-1]]);
        start = null;
      }
    }
  }
  if (start !== null) {
    spans.push([start, xvals[xvals.length-1]]);
  }

  return spans;
}

// Remove a single point. If this point represents grouped data remove all
// points in underlying raw series data, series.xData.
function removePoint(point) {
  var toNullify = findXDataPoints(point),
      i = 0;

  // Series reference may disappear after point removal so save here
  var series = point.series,
      chart = point.series.chart,
      xData = point.series.xData;
  // Remove points
  for (i=0; i<toNullify.length; i++) {
    console.log("removed " + new Date(toNullify[i][1]).toISOString());
    // Since we're modifying array always remove point at first index in list
    series.removePoint(toNullify[0][0], false);
  }
  // Add back null points to create gap
  for (i=0; i<toNullify.length; i++) {
    series.addPoint([toNullify[i][1], null], false);
  }
  chart.redraw();
}

// Return an array of 2-tuples for series.xData points corresponding to the
// input point. This input point may be a single point representing one
// item in series.xData or it may represent grouped data for many points in
// series.xData. The 2-tuples in the returned array contain:
// [xData index, xData value]
function findXDataPoints(point) {
  var found = [], i;
  if (! point.series.hasGroupedData) {
    for (i=0; i<point.series.xData.length; i++) {
      if (point.series.xData[i] === point.x) {
        found.push([i, point.series.xData[i]]);
        break;
      }
    }
  } else {
    var end = point.x + point.series.currentDataGrouping.count *
              point.series.currentDataGrouping.unitRange;
    for (i=0; i<point.series.xData.length; i++) {
      if (point.series.xData[i] >= point.x && point.series.xData[i] < end) {
        found.push([i, point.series.xData[i]]);
      }
    }
  }
  return found;
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

// Return the distance between two coordinates in km
// http://stackoverflow.com/questions/365826/calculate-distance-between-2-gps-coordinates
// by cletus.  Which answer was itself based on
// http://www.movable-type.co.uk/scripts/latlong.html
//
// Args:
//     lonlat1 and lonlat2 are two-item arrays of decimal degree
//     latitude and longitude.
function geo2km(lonlat1, lonlat2) {
  if (! lonlat1 || ! lonlat2) {
    return 0;
  }
  var toRad = function(degree) { return degree * (Math.PI / 180); };
  var R = 6371; // km radius of Earth
  var dLat = toRad(lonlat2[1] - lonlat1[1]);
  var dLon = toRad(lonlat2[0] - lonlat1[0]);
  var lat1 = toRad(lonlat1[1]);
  var lat2 = toRad(lonlat2[1]);

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return d;
}

// Return speed in knots traveling between lonlat1 and lonlat2 during time
// interval t1 to t2.
//
// Args:
//     lonlat1 and lonlat2 are two-item arrays of decimal degree
//     latitude and longitude.
//
//     t1 and t2 are Date objects corresponding to coordinates.
function geo2knots(lonlat1, lonlat2, t1, t2) {
  kmPerKnot = 1.852;  // 1 knot = 1.852 km/h
  km = geo2km(lonlat1, lonlat2);
  hours = (t2.getTime() - t1.getTime()) / 1000 / 60 / 60;
  return km / hours / kmPerKnot;
}
