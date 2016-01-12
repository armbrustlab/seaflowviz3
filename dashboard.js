// SeaFlow realtime dashboard

function Dashboard(events) {
  var self = this;

  self.refreshTimeMilli = 3 * 60 * 1000; // every 3 minute
  self.events = events;  // will register jQuery events
  self.latest = 1437783583000;    // Date to start pulling data from
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
      "2015-06-18 - 2015-06-19": "SCOPE_4",
      "2015-07-18 - 2015-07-22": "SCOPE_5",
      "2015-07-25 - 2015-08-05": "SCOPE_6",
      "realtime": "realtime"
    };
    return lookup[cruise];
  };

  // Decide which table to use for SFL data
  self.SflTableLookup = function(cruise) {
    if (cruise === "realtime") {
      return "SeaFlow Sfl Data Realtime";
    } else {
      return "SeaFlow Sfl Data Archive";
    }
  };

  self.StatTableLookup = function(cruise) {
    if (cruise === "realtime") {
      return "SeaFlow Simple Pop Realtime";
    } else {
      return "SeaFlow Simple Pop Archive";
    }
  };

  // Register event handlers here
  // Population
  $(self.events).on("newsfldata", function(event, data) {
    self.getSQLShareData({
      cur: self.data.stat,
      //from: self.latest,
      //to: self.latest + self.increment,
      table: self.StatTableLookup(self.cruise),
      event: "newstatdata",
      recordHandler: sqlshareStatHandler
    });
  });
  // CSTAR
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

  self.pollOnce = function() {
    self.getSQLShareData({
      cur: self.data.sfl,
      //from: self.latest,
      //to: self.latest + self.increment,
      table: self.SflTableLookup(self.cruise),
      event: "newsfldata",
      recordHandler: sqlshareSflHandler,
      extra: function(allData, newData) {
        addSpeed(allData);
      }
    });
  };

  $(self.events).on("newcruise", function(event, data) {
    self.cruise = self.cruiseFieldLookup(data.cruise);
    console.log("new cruise is " + data.cruise + " => " + self.cruise);
    self.resetData();
    if (self.cruise === "realtime") {
      self.poll();
    } else {
      // Clear any existing data polling if previous cruise was realtime
      if (self.pollInterval) {
        clearInterval(self.pollInterval);
        self.pollInterval = null;
      }
      self.pollOnce();
    }
  });

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
  //   table: Name of the SQLShare table to query
  //   select: Select string. Defaults to "*"
  //   event: Name of the event to trigger as last step
  //   recordHandler: Function to process one record returned from SQLShare
  //   extra: Any custom processing one new and accumulated data can be done
  //     in this function. It receives two parameters, allData and newData,
  //     which contain all records and new records processed by recordHandler.
  //     This function will run immediately before the event is triggered.
  self.getSQLShareData = function(o) {
    o.select = o.select ? o.select : "*";
    if (o.from === "undefined" && o.cur.length) {
      o.from = _.last(_.pluck(cur, "date"));
    }
    var query = "SELECT ";
    query += o.select + " FROM [seaflow.viz@gmail.com].[" + o.table + "] ";
    query += "WHERE cruise = '" + self.cruise + "' ";
    if (o.from) {
      query += "AND [time] >= '" + new Date(o.from).toISOString() + "' ";
      if (o.to) {
        query += "AND [time] < '" + new Date(o.to).toISOString() + "' ";
      }
    }
    query += "ORDER BY [time] ASC";
    executeSqlQuery(query, function(jsonp) {
      var data = transformData(jsonp, o.recordHandler);
      fillGaps(o.cur, data);  // fill gaps in record will null objects
      o.cur.push.apply(o.cur, data);  // Add new data to cur
      if ($.isFunction(o.extra)) {
        // Run user supplied extra function
        o.extra(o.cur, data);
      }
      $(self.events).triggerHandler(o.event, { all: o.cur, new: data });
    });
  };

  self.resetData = function() {
    self.data = {
      sfl: [],
      stat: [],
      cstar: []
    };
  };
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
  var data = [];
  jsonp.data.forEach(function(d) {
    sqlshareRecordHandler(d, idx, data);
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

function sqlshareSflHandler(d, idx, data) {
  var curTime = Date.parse(d[idx.time]);
  data.push({
    date: curTime,
    iso8601: iso(curTime),
    lat: d[idx.lat],
    lon: d[idx.lon],
    temp: d[idx.ocean_tmp],
    salinity: d[idx.salinity],
    par: Math.max(d[idx.par], 0)
  });
}

function sqlshareStatHandler(d, idx, data) {
  if (popLookup[d[idx.pop]]) {  // don't want to include unknown pops
    var curTime = Date.parse(d[idx.time]),
        prev = _.last(data);
    if (prev && prev.date === curTime) {
      prev.pops[popLookup[d[idx.pop]]] = {
        fsc_small: d[idx.fsc_small],
        abundance: d[idx.abundance]
      };
    } else {
      var newData = {
        date: curTime,
        iso8601: iso(curTime),
        pops: {}
      };
      newData.pops[popLookup[d[idx.pop]]] = {
        fsc_small: d[idx.fsc_small],
        abundance: d[idx.abundance]
      };
      data.push(newData);
    }
  }
}

function sqlshareCstarHandler(d, idx, data) {
  var curTime = Date.parse(d[idx.time]);
  data.push({
    date: curTime,
    iso8601: iso(curTime),
    attenuation: d[idx.attenuation]
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
      console.log("Query returned " + jsonp.data.length + " data points");
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
