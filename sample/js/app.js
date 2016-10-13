//Map Tiles section
var attr_osm = 'Map data &copy; <a href="http://openstreetmap.org/">OpenStreetMap</a> contributors';
var osm = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
var googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
});

var map = new L.Map('map',{renderer:L.svg()}).addLayer(osm).setView(new L.LatLng(48.73, 19.61), 8);
map.addControl(new L.Control.Layers( {'Карта':osm, 'Спутник':googleHybrid}, {}));
map.autoLabeler.setAutoLabelOptions({labelsDelay:500,zoomToStartLabel:5,showBBoxes:true,annealingOptions:{
  maxtotaliterations:1000
}});
map.autoLabeler.toggleAutoLabelling();

if(L.Browser.touch){
  L.control.mapCenterCoord().addTo(map);
}else {
  L.control.mousePosition().addTo(map);//add mouse coords ctrl
}

var countries_lr = L.geoJSON(countries).addTo(map);
var rivers_lr = L.geoJSON(eurivers).addTo(map);

rivers_lr.enableAutoLabel({zoomToStartLabel:6});
