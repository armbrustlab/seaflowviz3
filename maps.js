// ****************************************************************************
// Maps
// ****************************************************************************
function SeaflowMap(div, events) {
  var self = this;
  self.events = events;
  // Objects with lat, lon, date, and map library specific coordinate object
  self.locs = [];
  self.cruiseLayer = null;

  self.cruiseMap = L.map(div).setView([47, -122], 4);
  L.Icon.Default.imagePath = '/leaflet/images';

  L.tileLayer.provider("Esri.OceanBasemap").addTo(self.cruiseMap);
  //localTileLayer("127.0.0.1:3002").addTo(self.cruiseMap);
  self.zoomed = false;
  self.min = null;
  self.max = null;

  L.control.mousePosition({
    position: "topright",
    separator: "   ",
    lngFormatter: function(lng) { return "Lon: " + lng.toFixed(5); },
    latFormatter: function(lat) { return "Lat: " + lat.toFixed(5); }
  }).addTo(self.cruiseMap);  // add mouse coordinate display

  // Register event handlers here
  $(self.events).on("newdaterange", function(event, data) {
    self.updateDateRange(data.min, data.max);
  });
  $(self.events).on("newsfldata", function(event, data) {
    self.addLocs(data.new);
  });
  $(self.events).on("newcruise", function(event, data) {
    self.locs = [];
    self.update();
    self.zoomed = false;
  });

  self.updateDateRange = function(minDate, maxDate) {
    self.min = minDate;
    self.max = maxDate;
    self.update();
  };

  self.addLocs = function(newLocs) {
    newLocs.forEach(function(loc) {
      if ($.isNumeric(loc.lat) && $.isNumeric(loc.lon)) {
        loc.latLng = new L.latLng(loc.lat, loc.lon);
        self.locs.push(loc);
      }
    });
    self.update();
  };

  self.update = function() {
    if (self.locs.length === 0) {
      return;
    }
    var allLatLngs = [];
    var selectedLatLngs = [];
    self.locs.forEach(function(doc) {
      allLatLngs.push(doc.latLng);
      if (self.min === null && self.max === null) {
        // All points selected if no date range has been set
        selectedLatLngs.push(doc.latLng);
      } else if (doc.date >= self.min && doc.date <= self.max) {
        selectedLatLngs.push(doc.latLng);
      }
    });
    var latestLatLng = allLatLngs[allLatLngs.length-1];
    var latestCircle = new L.CircleMarker(latestLatLng, {
      color: "gray",
      radius: 6,
      weight: 2,
      opacity: 0.75
    });
    var allCruiseLine = new L.polyline(allLatLngs, {
      color: "gray",
      weight: 3,
      opacity: 0.5,
      smoothFactor: 1
    });
    var selectedCruiseLine = new L.polyline(selectedLatLngs, {
      color: "red",
      weight: 4,
      opacity: 0.5,
      smoothFactor: 1
    });
    var fg = L.featureGroup([allCruiseLine, selectedCruiseLine, latestCircle]);

    if (self.cruiseLayer) {
      self.cruiseMap.removeLayer(self.cruiseLayer);
    }
    self.cruiseMap.addLayer(fg);
    self.cruiseLayer = fg;
    if (! self.zoomed) {
      // Only zoom to fit once
      self.cruiseMap.fitBounds(fg.getBounds());
      self.zoomed = true;
    }
  };
}

function localTileLayer(tileHost) {
  var tileURL = 'http://' + tileHost + '/{z}/{x}/{y}.png';
  var attribution = 'Map data &copy; ';
  attribution += '<a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ';
  attribution += '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>';
  return L.tileLayer(tileURL, {
    attribution: attribution,
    maxZoom: 8
  });
}
