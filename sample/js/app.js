//Map Tiles section
var attr_osm = 'Map data &copy; <a href="http://openstreetmap.org/">OpenStreetMap</a> contributors';
var osm = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
var googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
});

var map = new L.Map('map',{renderer:L.svg()}).addLayer(osm).setView(new L.LatLng(60, 30), 10);
map.addControl(new L.Control.Layers( {'Карта':osm, 'Спутник':googleHybrid}, {}));
map.setAutoLabelOptions({labelsDelay:500});
map.toggleAutoLabelling();
 // map.options.renderer.on("update",function(){console.log("updateds")});
 // map.on("zoomstart",function(){console.log("zoom st")});
 // map.on("zoomend",function(){console.log("zoom fin")});
 // map.on("moveend",function(){console.log("move fin")});
 // map.on("movestart",function(){console.log("move st")});
//map.on("viewreset",function(){console.log("vr fin")});
