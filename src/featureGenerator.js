
var featureGenerator = {
  _bounds:null, //latlng
  _pointsLayer:null,
  _map:null,

  setBounds:function(bounds){
   if(!bounds && !this._bounds)this.setMapBounds();
   this._bounds = bounds;
  },

  setMapBounds:function(){
    this._bounds = this._map.getBounds();
  },

  createLayers:function(onlycheck) {
    this._pointsLayer =(this._pointsLayer && onlycheck)?this._pointsLayer : L.featureGroup().addTo(this._map);
    this._pointsLayer =(this._polysLayer && onlycheck)?this._polysLayer : L.featureGroup().addTo(this._map);
    this._pointsLayer =(this._linesLayer && onlycheck)?this._linesLayer : L.featureGroup().addTo(this._map);
  },

  _genWord:function(length){
    var result=""
    for(var i=0;i<length;i++)result+="A";
    return result;
  },

  genPoints:function(count,wordlength){
    this._pointsLayer.clearLayers();
    if(!this._bounds)this.setMapBounds();
    var minx = this._bounds.getWest(), dx = this._bounds.getEast() - minx, miny = this._bounds.getNorth(), dy = this._bounds.getSouth() - miny;
    for(var i=0;i<count;i++){
      var pos = L.latLng(miny + Math.random()*dy,minx+Math.random()*dx);
      var marker = L.circleMarker(pos);
      if(!marker.feature)marker.feature = {};
      if(!marker.feature.properties)marker.feature.properties = {};
      marker.feature.properties.name = this._genWord(wordlength) +'_'+i;
      this._pointsLayer.addLayer(marker);
    }
  }
}

module.exports = featureGenerator;
