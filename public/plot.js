$(function () {
  var events = {};
  var map = new SeaflowMap("cruise-map", events);
  var charts = new Charts(events);
  var dash = new Dashboard(events);

  $("#pull").on("click", function() { console.log("pull"); dash.pollOnce(); });
  $("#plus").on("click", function() {
    dash.increment += 180000;
    console.log(new Date(dash.latest + dash.increment).toISOString());
  });
  window.charts = charts;
  window.map = map;
  window.dash = dash;
});
