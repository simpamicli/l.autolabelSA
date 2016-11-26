//Map Tiles section
var attr_osm = 'Map data &copy; <a href="http://openstreetmap.org/">OpenStreetMap</a> contributors';
var osm = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
var googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
});

// var map = new L.Map('map',{renderer:L.svg()}).addLayer(osm).setView(new L.LatLng(60.04, 30.37), 12);
var map = new L.Map('map',{renderer:L.svg(),
                           autolabel:true,
                           autolabelOptions:{
                             labelsDelay:500,
                             zoomToStartLabel:5,
                             showBBoxes:true,
                             annealingOptions:{

                             }
                            }
                          }).addLayer(osm).setView(new L.LatLng(60.051, 30.331), 13);
//map.addControl(new L.Control.Layers( {'Карта':osm, 'Спутник':googleHybrid}, {}));

map.autoLabeler.toggleAutoLabelling();

if(L.Browser.touch){
  L.control.mapCenterCoord().addTo(map);
}else {
  L.control.mousePosition().addTo(map);//add mouse coords ctrl
}

//var countries_lr = L.geoJSON(countries).addTo(map);
/*var rivers_lr = L.geoJSON(eurivers,{
  onEachFeature:function(feature,layer){
    layer.on('mouseover mousemove', function(e){
      var content ='@'+layer._parts.length+'@'+ feature.properties.name + ' '+feature.properties.alabel_offset;
      var hover_bubble = new L.Rrose({ offset: new L.Point(0,-10), closeButton: false, autoPan: false })
        .setContent(content)
        .setLatLng(e.latlng)
        .openOn(map);
    });
    layer.on('mouseout', function(e){ map.closePopup() });
  }
}).addTo(map);*/


//rivers_lr.enableAutoLabel({zoomToStartLabel:6});

// var testGJ = L.geoJSON(testGEO).addTo(map);
// testGJ.enableAutoLabel({});

map.options.renderer.padding = 0;
