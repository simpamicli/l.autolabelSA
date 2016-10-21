(function(){
  var vl_style = function(feature) {
    try{
      switch (feature.properties.u) {
        case '35': return {color: "#ff0000"};
        case '110':   return {color: "#0000ff"};
      }
    }catch(err){
      console.log('TOFIX: search plugin style err');
    }
  }

  gl=L.geoJSON(lines,
  		{
  		style: vl_style
  		}
  ).addTo(map);
  gl.enableAutoLabel({zoomToStartLabel:11});
})();

(function (){
  var geojsonMarkerOptions = {
      radius: 8,
      fillColor: "#ff7800",
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
  };
	opl=L.geoJSON(ops,
			{
			pointToLayer:
				function (feature, latlng) {
					var c = L.circleMarker(latlng,geojsonMarkerOptions);
          return c;
				}
			}
	);
  //make oporas layer invisible on low zoom
  map.on('zoomend',
  	function () {
      if(opl){
    		if (map.getZoom() < 14 && map.hasLayer(opl)) {
    			map.removeLayer(opl);
    		}
    		if (map.getZoom() >=14 && map.hasLayer(opl) == false )
    		{
    		//	map.addLayer(opl);
    		}
      }
  	}
  );
})();
