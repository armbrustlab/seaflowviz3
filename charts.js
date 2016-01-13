function Charts(events) {
  var self = this;

  self.charts = {};
  self.events = events;

  // Configure charts
  setDefaultChartOptions();

  // Register event handlers here
  $(self.events).on("newsfldata", function(event, data) {
    //console.log("newsfldata");
    addToSingleSeries(self.charts.speed, data.new, "speed", "Speed");
    addToSingleSeries(self.charts.ts, data.new, "salinity", "Salinity");
    addToSingleSeries(self.charts.ts, data.new, "temp", "Temperature");

    addToNavigatorSeries(self.charts.abundance, data.new, "par");

    addXPlotBands(self.charts.fsc_small.xAxis[0], data.all, "par");
    addXPlotBands(self.charts.abundance.xAxis[0], data.all, "par");
  });
  $(self.events).on("newstatdata", function(event, data) {
    //console.log("newstatdata");
    addToPopSeries(self.charts.fsc_small, data.new, "fsc_small");
    addToPopSeries(self.charts.abundance, data.new, "abundance");
  });
  $(self.events).on("newcstardata", function(event, data) {
    addToSingleSeries(self.charts.cstar, data.new, "attenuation", "Attenuation");
  });
  $(self.events).on("newdaterange", function(event, data) {
    //console.log("newdaterange: " + isoext(data));
    Object.keys(self.charts).forEach(function(c) {
      if (self.charts[c] && self.charts[c] !== data.triggerChart) {
        setTimeout(function() {
          self.charts[c].xAxis[0].setExtremes(data.min, data.max, true, false);
        }, 0);
      }
    });
  });
  $(self.events).on("newcruise", function(event, data) {
    //console.log("newcruise");
    initCharts();  // clear charts
  });

  // Define a handler for setExtreme x-axis events
  function setExtremesHandler(e) {
    //console.log("setExtremesHandler: " + isoext(e));
    if (e.trigger === "navigator") {
      //console.log("  navigator:");
      navigatorNewDateRange(e.min, e.max, this.chart);
    } else if (e.trigger === "updatedData") {
      var ext = this.chart.xAxis[0].getExtremes();
      //console.log("  updatedData: " + isoext(ext));
      $(self.events).triggerHandler("newdaterange", {
        min: ext.min,
        max: ext.max,
        triggerChart: ""
      });
    }
  }

  var navigatorNewDateRange = _.debounce(function(min, max, chart) {
    $(self.events).triggerHandler("newdaterange", {
      min: min,
      max: max,
      triggerChart: chart
    });
  }, 200);

  function initCharts() {
    // Make empty charts
    if (self.charts.speed) {
      self.charts.speed.destroy();
    }
    self.charts.speed = makeLineChart({
      title: null,
      yAxisTitle: "Speed",
      series: [{name: "Speed", data: []}],
      seriesValueSuffix: " knots",
      div: "speed",
      showLegend: false,
      showNavigator: false,
      showXAxis: false,
      yTickPixelInterval: 30,
      spacingLeft: 35
    });

    if (self.charts.ts) {
      self.charts.ts.destroy();
    }
    self.charts.ts = makeLineChart({
      title: null,
      yAxisTitle: ["Salinity", "Temp"],
      series: [{name: "Salinity", data: []}, {name: "Temperature", data: []}],
      seriesValueSuffix: [" psu", " C"],
      div: "ts",
      showLegend: false,
      showNavigator: false,
      showXAxis: true,
      yTickPixelInterval: 30
    });

    if (self.charts.fsc_small) {
      self.charts.fsc_small.destroy();
    }
    self.charts.fsc_small = makeLineChart({
      title: null,
      yAxisTitle: "Forward scatter",
      series: makeEmptyPopSeries(),
      seriesValueSuffix: " a.u.",
      div: "size",
      showLegend: true,
      showNavigator: false,
      showXAxis: false,
      logY: true
    });

    if (self.charts.abundance) {
      self.charts.abundance.destroy();
    }
    self.charts.abundance = makeLineChart({
      title: null,
      yAxisTitle: "Abundance",
      series: makeEmptyPopSeries(),
      seriesValueSuffix: " 10^6 cells/L",
      div: "abundance",
      showLegend: true,
      showNavigator: true,
      showXAxis: true,
      setExtremes: setExtremesHandler
    });

    if (self.charts.cstar) {
      self.charts.cstar.destroy();
    }
    /*self.charts.cstar = makeLineChart({
      title: null,
      yAxisTitle: "Attenuation",
      series: [{name: "Attenuation", data: []}],
      seriesValueSuffix: " m-1",
      div: "cstar",
      showLegend: false,
      showNavigator: false,
      showXAxis: false,
      yTickPixelInterval: 30
    });*/
  }
}

/*
options object:
  title:
    Sets chart title text
    http://api.highcharts.com/highstock#title.text
  yAxisTitle:
    Sets y-axis title text. If there are exactly 2 series and they should each
    have their own y-axis, specify y-axis titles here as an array.
    http://api.highcharts.com/highstock#yAxis.title.text
  div:
    ID for div container of chart
    http://api.highcharts.com/highstock#chart.renderTo
  showLegend:
    Show a legend for multiple series
    http://api.highcharts.com/highstock#legend.enabled
  showNavigator:
    Create a navigator with empty series data.
  showXAxis:
    show x-axis
  yTickPixelInterval:
    Pixel interval size between y-axis ticks.
    http://api.highcharts.com/highstock#yAxis.tickPixelInterval
  series:
    Series array for chart data. Each element should contain a name and data
    array of x, y values. If there are exactly 2 series and they should have
    separate y-axes, specify an array of 2 titles for yAxisTitle.
    http://api.highcharts.com/highstock#series<line>.name
    http://api.highcharts.com/highstock#series<line>.data
  seriesValueSuffix:
    String to append to the end of each value in tooltip box. If this property
    is an array of the same length as series, a different suffix can be
    be specified for each series in order. If this property is not an array then
    this value will be used as a suffix for all series.
    http://api.highcharts.com/highstock#series<line>.tooltip.valueSuffix
  setExtremes:
    Callback to handle setExtremes event.
    http://api.highcharts.com/highcharts#xAxis.events.setExtremes
  spacingLeft:
    Pixels to pad left. Necessary to match alignment of left border of
    charts with left y-axis label and charts without left y-axis label.
  logY: logarithmic Y-axis?
Returns:
 Highcharts.Chart object
*/
function makeLineChart(options) {
  var nav = {
    enabled: false
  };
  if (options.showNavigator) {
    nav = {
      enabled: true,
      adaptToUpdatedData: true,
      series: {
          data: []
      }
    };
  }
  var xAxis = {
    type: "datetime",
    events: {
      setExtremes: options.setExtremes
    },
    ordinal: false
  };
  if (! options.showXAxis) {
    xAxis.labels = { enabled: false };
    xAxis.lineWidth = 0;
    xAxis.lineColor = "transparent";
    xAxis.tickLength = 0;
    xAxis.minorTickLength = 0;
  }

  var chart = {
    renderTo: options.div
  };
  var yAxis = {};
  if ($.isArray(options.yAxisTitle) && options.yAxisTitle.length === 2) {
    // 2 y-axes
    options.series[0].yAxis = 1;  // first series will have left y-axis

    // Color y-axes same as series lines
    chart.events = {
      load: function(e) {
        this.yAxis[0].update({
          title: {
            style : {
              "color": this.series[1].color
            }
          },
          labels: {
            style: {
              "color": this.series[1].color
            }
          }
        }, false);
        this.yAxis[1].update({
          title: {
            style : {
              "color": this.series[0].color
            }
          },
          labels: {
            style: {
              "color": this.series[0].color
            }
          }
        }, true);
      }
    };

    // Create two y-axes
    yAxis = [
      {
        title: {
          text: options.yAxisTitle[1]
        },
      },
      {
        title: {
          text: options.yAxisTitle[0]
        },
        gridLineWidth: 0,
        opposite: false,
        labels: {
          align: "left",
          x: 0
        }
      }
    ];
    if (options.yTickPixelInterval) {
      yAxis.forEach(function(y) {
        y.tickPixelInterval = options.yTickPixelInterval;
      });
    }
  } else {
    // Create left spacing to match charts with left y-axis
    if (options.spacingLeft) {
      chart.spacingLeft = options.spacingLeft;
    }

    // Support one item array for yAxisTitle
    if ($.isArray(options.yAxisTitle)) {
      options.yAxisTitle = options.yAxisTitle[0];
    }

    // Assign y-axis title
    yAxis.title = { text: options.yAxisTitle };

    // Set tickPixelInterval
    if (options.yTickPixelInterval) {
      yAxis.tickPixelInterval = options.yTickPixelInterval;
    }
  }

  if (options.logY) {
    yAxis.type = "logarithmic";
  }

  if (options.seriesValueSuffix) {
    if ($.isArray(options.seriesValueSuffix)) {
      // Set tooltip value suffix for each series
      if (options.seriesValueSuffix.length == options.series.length) {
        options.seriesValueSuffix.forEach(function(suff, i) {
          options.series[i].tooltip = { valueSuffix: suff };
        });
      }
    } else {
      // Set tooltip value suffix the same for all series
      options.series.forEach(function(s) {
        s.tooltip = { valueSuffix: options.seriesValueSuffix };
      });
    }
  }

  var c = new Highcharts.StockChart({
    chart: chart,
    legend: {
      enabled: options.showLegend
    },
    navigator: nav,
    rangeSelector: {
      enabled: false
    },
    title: {
      text: options.title,
    },
    xAxis: xAxis,
    yAxis: yAxis,
    scrollbar: {
      enabled: false
    },
    series: options.series
  });
  c.showLoading();
  return c;
}

/*
Set options common to all charts
*/
function setDefaultChartOptions() {
  var headerFormat = '<span style="font-size: 10px"><strong>{point.key}</strong>';
  headerFormat += '<br/>Click point to remove from plot<br /></span>';

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
      hideDelay: 100,
      headerFormat: headerFormat
    },
    chart: {
      plotBorderWidth: 2,
      spacingBottom: 3
    },
    yAxis: {
      floor: 0,
      maxPadding: 0.05
    }
  });
}


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


function makeEmptyPopSeries() {
  var series = [],
      legendIndex = 0;
  popLabels.forEach(function(pop) {
    series.push({name: pop, data: [], legendIndex: legendIndex});
    legendIndex++;
  });
  return series;
}

// If key is null then null will be used as dependent value
function addToSingleSeries(chart, data, key, seriesName) {
  var series = null;
  if (seriesName) {
    chart.series.forEach(function(s) {
      if (s.name === seriesName) {
        series = s;
      }
    });
  }
  if (series) {
    data.forEach(function(d) {
      if (key === null) {
        series.addPoint([d.date, null], false, false, false);
      } else {
        series.addPoint([d.date, d[key]], false, false, false);
      }
    });
    chart.hideLoading();
    chart.redraw();
  }
}

function addToPopSeries(chart, data, key) {
  var series = {}, subd;
  chart.series.forEach(function(s) {
    if (s.name !== "Navigator") {
      // Check if series pop name is valid to avoid adding to navigator
      // series if it exists
      series[s.name] = s; // lookup table by series name
    }
  });
  data.forEach(function(d) {
    _.keys(d.pops).forEach(function(p) {
      subd = d.pops[p];
      series[p].addPoint([d.date, subd[key]], false, false, false);
    });
  });
  chart.hideLoading();

  // This redraw fires setExtremes with trigger === "updatedData" if the max
  // of the extremes range was already pinned to the latest date. The max date
  // of the extremes will be reset to match new latest date.
  chart.redraw();
}

function addXPlotBands(axis, data, key) {
  var xvals = data.map(function(d) { return d.date; }),
      yvals = data.map(function(d) { return d[key]; });
  var spans = lowSpans(xvals, yvals, 0.02),
      curBands = axis.plotLinesAndBands,
      ids = [],
      idstart = 0,
      id = 0;
  if (curBands.length) {
    ids = _.pluck(curBands, "id");
    ids.forEach(function(i) {
      axis.removePlotBand(i);
    });
  }
  spans.forEach(function(s) {
    axis.addPlotBand({
      color: "rgba(0, 0, 0, 0.1)",
      from: s[0],
      to: s[1],
      id: id++
    });
  });
}

function addToNavigatorSeries(chart, data, key) {
  var nav = getNavigator(chart),
    plotExtremes = chart.xAxis[0].getExtremes(),
    navExtremes = chart.xAxis[1].getExtremes(),
    pinRight = false,
    selectAll = false,
    latest = null;

  if (plotExtremes.max === undefined) {
    // No plot region has been selected. Select whole nav region after adding
    // data.
    selectAll = true;
  } else if (plotExtremes.max === navExtremes.max) {
    // Current selection is pinned to the latest data before adding new data
    pinRight = true;
  }
  if (nav) {
    data.forEach(function(d) {
      nav.addPoint([d.date, d[key]], false);
    });
  }
  latest = _.last(_.pluck(data, "date"));  // Get latest timestamp

  plotExtremes = chart.xAxis[0].getExtremes();
  navExtremes = chart.xAxis[1].getExtremes();

  if (selectAll) {
    // Select all data covered by navigator series
    chart.xAxis[0].setExtremes(navExtremes.min, latest);
  } else if (pinRight) {
    // Increase right-most part of selection to include latest data
    chart.xAxis[0].setExtremes(plotExtremes.min, latest);
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
// in y <= cutoff.
function lowSpans(xvals, yvals, cutoff) {
  var spans = [],
      start = null;

  for (var i=0; i<xvals.length; i++) {
    // null values are treated as above cutoff
    if (yvals[i] !== null && yvals[i] <= cutoff) {
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
    //console.log("removed " + new Date(toNullify[i][1]).toISOString());
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

function iso(d) {
  return new Date(d).toISOString();
}

function isoext(ext) {
  if (ext.min && ext.max) {
    return new Date(ext.min).toISOString() + " " + new Date(ext.max).toISOString();
  }
  return "undefined undefined";
}
