var express = require("express");
var compression = require("compression");
var sqlite3 = require("sqlite3").verbose();



function get_sfl(db, cruise, begin, end, cb) {
  //var fields = "cruise, file, date, lat, lon, salinity, ocean_tmp, par, epoch_ms";
  var fields = "lat, lon, salinity, ocean_tmp as temp, par, epoch_ms";
  var sql = "SELECT " + fields + " FROM sfl WHERE cruise = ?";
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
      console.log("Error: get_sfl");
      console.log(err);
    } else {
      cb(rows);
    }
  });
}

function get_stat(db, cruise, begin, end, cb) {
  //var fields = "cruise, file, date, fsc_small, abundance, pop, epoch_ms";
  var fields = "fsc_small, abundance, pop, epoch_ms";
  var sql = "SELECT " + fields + " FROM stat WHERE cruise = ?";
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
      console.log("Error: get_stat");
      console.log(err);
    } else {
      cb(rows);
    }
  });
}

if (process.argv.length < 3) {
  console.log("usage: node index.js sqlite3.db");
  process.exit();
}
var dbpath = process.argv[2];
var db = new sqlite3.Database(dbpath);
var app = express();
app.use(compression());
app.set('jsonp callback name', 'callback');

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

app.listen(3000);
