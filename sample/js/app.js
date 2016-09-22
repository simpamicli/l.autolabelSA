//Map Tiles section
var attr_osm = 'Map data &copy; <a href="http://openstreetmap.org/">OpenStreetMap</a> contributors';
var osm = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
var googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
});

var map = new L.Map('map',{}).addLayer(osm).setView(new L.LatLng(60, 30), 10);
map.addControl(new L.Control.Layers( {'Карта':osm, 'Спутник':googleHybrid}, {}));
