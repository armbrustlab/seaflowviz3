// Serve SeaFlow SFL and stat population data from a SQLite3 DB created with
// https://github.com/armbrustlab/seaflowviz3/bin/import_sfl_stat.py
var compression = require("compression");
var express = require("express");
var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();


function get_cruise_data(db, table, fields, cruise, begin, end, cb) {
  var sql = "SELECT " + fields + " FROM " + table + " WHERE cruise = ?";
  var params = [cruise];
  if (begin) {
    sql += " AND epoch_ms >= ?";
    params.push(begin.toString());
  }
  if (end) {
    sql += " AND epoch_ms <= ?";
    params.push(end.toString());
  }
  sql += " ORDER BY epoch_ms ASC";

  db.all(sql, params, function(err, rows) {
    if (err) {
      console.log("Error: get_cruise_data(" + table + ")");
      console.log(err);
    } else {
      cb(rows);
    }
  });
}

function get_sfl(db, cruise, begin, end, cb) {
  var fields = "lat, lon, salinity, ocean_tmp as temp, par, epoch_ms";
  get_cruise_data(db, "sfl", fields, cruise, begin, end, cb);
}

function get_stat(db, cruise, begin, end, cb) {
  var fields = "fsc_small, abundance, pop, epoch_ms";
  get_cruise_data(db, "stat", fields, cruise, begin, end, cb);
}


if (process.argv.length < 3) {
  console.log("usage: node index.js sqlite3.db [port]");
  process.exit();
}
var portnum = 3000;
var dbpath = process.argv[2];
if (process.argv.length == 4) {
  portnum = +process.argv[3];
}

try {
  fs.accessSync(dbpath, fs.F_OK);
  // Database file already exists
  console.log("Found SQLite3 db file " + dbpath);
} catch (e) {
  console.log("SQLite3 db file " + dbpath + " does not exist");
  process.exit(1);
}

var db = new sqlite3.Database(dbpath);
var app = express();
app.use(compression());
app.set('jsonp callback name', 'callback');
app.listen(portnum);
console.log("Listening on port " + portnum);

app.get('/sfl', function(req, res) {
  get_sfl(db, req.query.cruise, req.query.begin, req.query.end, function(rows) {
    res.jsonp(rows);
  });
});

app.get('/stat', function(req, res) {
  get_stat(db, req.query.cruise, req.query.begin, req.query.end, function(rows) {
    res.jsonp(rows);
  });
});
