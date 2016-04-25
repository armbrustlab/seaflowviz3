// SeaFlow realtime dashboard

function Dashboard(events) {
  var self = this;

  self.refreshTimeMilli = 2 * 60 * 1000; // every 3 minute
  self.events = events;  // will register jQuery events
  self.latest = 0;  // Date to start pulling data from
  self.increment = 180000;  // 3 minutes in ms
  self.cruise = "realtime";
  self.pollInterval = null;

  self.data = {
    sfl: [],
    stat: [],
    cstar: []
  };

  // Convert dropdown menu cruise name value to database cruise field name
  self.cruiseFieldLookup = function(cruise) {
    var lookup = {
      "2014-12-08 - 2014-12-12": "SCOPE_1",
      "2015-03-21 - 2015-03-29": "SCOPE_2",
      "2015-05-22 - 2015-05-26": "SCOPE_3",
      "2015-07-18 - 2015-07-22": "SCOPE_5",
      "2015-07-25 - 2015-08-05": "SCOPE_6",
      "realtime": "realtime"
    };
    return lookup[cruise];
  };

  // ****************************
  // Register event handlers here
  // ****************************

  // New cruise event
  // Begin data polling, which usually leads to asking for new SFL data
  $(self.events).on("newcruise", function(event, data) {
    // Convert UI cruise name to database cruise name
    self.cruise = self.cruiseFieldLookup(data.cruise);
    console.log("new cruise is " + data.cruise + " => " + self.cruise);

    // Clear any existing data polling
    clearInterval(self.pollInterval);
    self.pollInterval = null;

    // Reset existing state
    self.resetData();

    // Get new data
    if (self.cruise === "realtime") {
      self.poll();
    } else {
      self.pollOnce();
    }
  });

  // New SFL data event
  // Chain into asking for new population data
  $(self.events).on("newsfldata", function(event, data) {
    self.getData({
      cur: self.data.stat,
      //from: self.latest,
      //to: self.latest + self.increment,
      table: "stat",
      event: "newstatdata",
      recordHandler: statHandler
    });
  });

  // New population data event
  // Chain into asking for CSTAR data
  /*$(self.events).on("newstatdata", function(event, data) {
    self.getSQLShareData({
      cur: self.data.cstar,
      //from: self.latest,
      //to: self.latest + self.increment,
      table: "SeaFlow CSTAR Data",
      event: "newcstardata",
      recordHandler: sqlshareCstarHandler,
      extra: function(allData, newData) {
        self.latest += self.increment;
        self.increment = 180000;
      }
    });
  });*/

  // **************************
  // Database polling functions
  // **************************

  // Poll for new data once.
  // Starts with SFL data which can lead to a chain of data requests,
  // e.g. stat.csv population data.
  self.pollOnce = function() {
    self.getData({
      cur: self.data.sfl,
      //from: self.latest,
      //to: self.latest + self.increment,
      table: "sfl",
      event: "newsfldata",
      recordHandler: sflHandler,
      extra: function(allData, newData) {
        addSpeed(allData);
      }
    });
  };

  // Poll for new data at regular intervals
  self.poll = function() {
    self.pollOnce();  // Get data now
    // Setup to get data at intervals in the future
    self.pollInterval = setInterval(self.pollOnce, self.refreshTimeMilli);
  };


  // options object o:
  //   cur: Array containing current data which will be appended to
  //   from: Get all data newer than this date (epoch milliseconds).
  //     Defaults to newest date in cur.
  //   to: If this is a number, get data between from and to
  //   table: Name of the table to query
  //   event: Name of the event to trigger as last step
  //   recordHandler: Function to process one record returned query
  //   extra: Any custom processing one new and accumulated data can be done
  //     in this function. It receives two parameters, allData and newData,
  //     which contain all records and new records processed by recordHandler.
  //     This function will run immediately before the event is triggered.
  self.getData = function(o) {
    if (o.from === undefined && o.cur.length) {
      // Latest epoch timestamp plus 1 ms
      o.from = _.last(_.pluck(o.cur, "date")) + 1;
    }
    getjsonp(o.table, self.cruise, o.from, o.to, function(jsonp) {
      var data = transformData(jsonp, o.recordHandler);
      fillGaps(o.cur, data);  // Fill gaps in record with null objects
      o.cur.push.apply(o.cur, data);  // Add new data to cur
      if ($.isFunction(o.extra)) {
        // Run user supplied extra function
        o.extra(o.cur, data);
      }
      if (data.length) {
        console.log("latest=" + new Date(_.last(_.pluck(data, "date"))).toISOString());
        $(self.events).triggerHandler(o.event, { all: o.cur, new: data });
      }
    });
  };

  self.resetData = function() {
    self.data = {
      sfl: [],
      stat: [],
      cstar: []
    };
    self.latest = 0;
  };
}

// Turn jsonp data into an arrays of JSON objects
// that can be easily fed to visualizations
function transformData(jsonp, recordHandler) {
  var data = [];
  jsonp.forEach(function(d) {
    recordHandler(d, data);
  });
  return data;
}

// If there are gaps in the data, defined as more than 4 minutes between
// records, insert a null record with null data and time of prev + 4 minutes
function fillGaps(curData, newData) {
  if ((curData.length === 0 && newData.length === 1) || newData.length === 0) {
    return;
  }
  var prev, i;
  if (curData.length) {
    prev = _.last(curData);
    i = 0;
  } else {
    prev = newData[0];
    i = 1;
  }
  while (i < newData.length) {
    if (newData[i].date - prev.date > 4 * 60 * 1000) {
      // Need a null spacer object at i
      var nullData = nulled(newData[i]);
      nullData.date = prev.date + 4 * 60 * 1000;
      prev = newData[i];  // current becomes prev
      newData.splice(i, 0, nullData);  // insert nulled object before current
      i += 2;  // move 2 forward to skip object that got shifted forward
    } else {
      prev = newData[i];
      i++;
    }
  }
}

function nulled(o) {
  var nulledo = {};
  _.keys(o).forEach(function(k) {
    if (_.isObject(o[k])) {
      nulledo[k] = nulled(o[k]);  // object, nullify items in object
    } else {
      nulledo[k] = null;  // not an object, assume should get null value
    }
  });
  return nulledo;
}

function sflHandler(d, data) {
  d.date = d.epoch_ms;
  d.iso8601 = iso(d.epoch_ms);
  if (d.par !== undefined && d.par !== null) {
  d.par = Math.max(d.par, 0);
  }
  data.push(d);
}

function statHandler(d, data) {
  d.date = d.epoch_ms;
  if (popLookup[d.pop]) {  // don't want to include unknown pops
    var curTime = d.date,
        prev = _.last(data);

    if (prev && prev.date === curTime) {
      prev.pops[popLookup[d.pop]] = {
        fsc_small: d.fsc_small,
        abundance: d.abundance
      };
      // Make sure a Prochlorococcus / Synechococcus ratio is present
      if (prev.prosyn === null) {
        if (prev.pops.Prochlorococcus !== undefined &&
            prev.pops.Synechococcus !== undefined &&
            prev.pops.Prochlorococcus.abundance &&
            prev.pops.Synechococcus.abundance) {
          prev.prosyn = prev.pops.Prochlorococcus.abundance / prev.pops.Synechococcus.abundance;
        }
      }
    } else {
      var newData = {
        date: curTime,
        iso8601: iso(curTime),
        prosyn: null,
        pops: {}
      };
      newData.pops[popLookup[d.pop]] = {
        fsc_small: d.fsc_small,
        abundance: d.abundance
      };
      data.push(newData);
    }
  }
}

function cstarHandler(d, data) {
  d.date = d.epoch_ms;
  d.iso8601 = iso(d.epoch_ms);
  d.attenuation = d.attenuation;
  data.push(d);
}

function getjsonp(table, cruise, begin, end, cb) {
  var url = "http://52.0.94.129/";  // Must end in a slash!
  //var url = "http://localhost:3000/";  // Must end in a slash!
  url += table + "?cruise=" + encodeURIComponent(cruise);
  if (begin) {
    url += "&begin=" + encodeURIComponent(begin.toString());
  }
  if (end) {
    url += "&end=" + encodeURIComponent(end.toString());
  }
  var t0 = new Date();
  $.ajax({
    url : url,
    dataType : "jsonp",
    type : "GET",
    jsonp : "callback",
    crossDomain : "true",
    error : function(xhr, ts, et) {
      alert("error errorThrow:" + et);
    },
    success : function(jsonp) {
      console.log("Query took " +
                  (((new Date().getTime()) - t0.getTime())/1000) + " sec");
      console.log("Query returned " + jsonp.length + " data points");
      cb(jsonp);
    }
  });
}

function addSpeed(data) {
  var prev = null;
  data.forEach(function(d) {
    if (prev) {
      if (! d.hasOwnProperty("speed")) {
        d.speed = geo2knots([prev.lon, prev.lat], [d.lon, d.lat],
                            new Date(prev.date), new Date(d.date));
      }
    } else {
      d.speed = null;
    }
    prev = d;
  });
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
    return null;
  }
  if (lonlat1[0] === null || lonlat1[1] === null ||
      lonlat2[0] === null || lonlat2[1] === null) {
    return null;
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
  if (km === null) {
    return null;
  }
  return km / hours / kmPerKnot;
}
