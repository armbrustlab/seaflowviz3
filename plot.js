$(function () {
  var events = {};
  var map = new SeaflowMap("cruise-map", events);
  var charts = new Charts(events);
  var dash = new Dashboard(events);

  $("div.dropdown li a").on("click", function() {
    var cruise = $(this).text();
    $(events).triggerHandler("newcruise", {cruise: cruise});
    $(".btn:first-child").html(cruise + " <span class='caret'></span>");
  });

  $(events).triggerHandler("newcruise", {cruise: "2015-07-25 - 2015-08-05"});

  window.charts = charts;
  window.map = map;
  window.dash = dash;
});
