/**
Module to extract sufficient info to label data on the map
*/
var DOMEssentials = require("./DOMEssentials.js");
var geomEssentials = require("./geomEssentials.js");

var dataReader = {
  /**
  creates an array of features's segments for each feature  of layers2label's layers on screen along with SVG text corresponding to
  @returns [Array] returns an array with values : {t:{content_node:SVG textnode},parts:feature parts,layertype}, then, in next funcs we add apoly param to t object, ir, its bounding polygon, layertype = 0 marker, 1 polyline, 2 polygon
  @memberof MapAutoLabelSupport#
  */
  readDataToLabel:function(){
    var pt  =[];
    if(this._map){
      for(var i=0;i<this._map._layers2label.length;i++){
        var lg=this._map._layers2label[i];
        var ll2 = this._map._layers2label;
        var map_to_add = this._map;
        lg.eachLayer(function(layer){
          if(layer.feature)
          if(layer.feature.properties[lg._al_options.propertyName]){
            var node =DOMEssentials.createSVGTextNode(layer.feature.properties[lg._al_options.propertyName],lg._al_options.labelStyle);
            var poly = DOMEssentials.getBoundingBox(map_to_add,node); //compute ortho aligned bbox for this text, only once, common for all cases
            var layer_type = 0;
            var centerOrParts;
            if(layer instanceof L.Polyline || layer instanceof L.Polygon){ //polyline case
                if(layer._parts.length>0){ //so, line is visible on screen and has property to label over it
                  layer_type = layer instanceof L.Polygon?2:1; //0 goes to marker or circlemarker
                  centerOrParts=layer._parts;
                }
              }
            else if (layer instanceof L.CircleMarker || L.Marker){
              centerOrParts = this._map.latLngToLayerPoint(layer.getLatLngs()); //so we adding only L.Point obj
            }
            if(centerOrParts){
              var toAdd = {t:{content_node:node,poly:poly},parts:centerOrParts, layertype: layer_type};
              pt.push(toAdd);
            }
            }
          }
        );
      }
    }
    return pt;
  },

  /**
  extracts good segments from available polyline parts and converts to use in next procedures of pos estimation
  @param {Array} ptcollection: each item is conatiner with t:label to draw for this polyline, parts - parts of this pline visible on screen in pixel coords
  @param {Set} options: options are: {float} minSegLen: if segment length less than this, it is skipped except it is the only one for current polyline, {integer} maxlabelcount: if more labels in ptcollection, then do nothing
  @memberof MapAutoLabelSupport#
  */
  prepareCurSegments(ptcollection,options){
    options = options || {};
    options.minSegLen = options.minSegLen || 200;
    options.maxlabelcount=options.maxlabelcount || 100;
    if(ptcollection.length>options.maxlabelcount){ //FIXME [prepareCurSegments] not aproper way to do things, to overcome two time rendering while zooming
      this._map.dodebug('too much labels to compute('+ptcollection.length+'>'+options.maxlabelcount+')');
      return [];
    }
    var allsegs=[];
    for(var i=0;i<ptcollection.length;i++){
      var item = ptcollection[i];
      if(item.layertype==0){//if point -> do nothing.
        allsegs.push({t:item.t,origin:t.parts,layertype:item.layertype});
        continue;
      }
      //else compute for lines and polygons
      //TODO[prepareCurSegments] add valid parsing for polygon case
      //now it is only fo lines
      var cursetItem=[]; //set of valid segments for this item
      var minimalsegsIfNoOthers=[];//set of non=valid segments, use in case if no valid there
      for(var j=0;j<item.parts.length;j++){ //here we aquire segments to label
        var curpart = item.parts[j];
        for(var k=1;k<curpart.length;k++){
          var a = curpart[k-1];
          var b = curpart[k];
          var ab = [a,b];
          if(geomEssentials.segLenOk(a,b,options.minSegLen))cursetItem.push(ab);else minimalsegsIfNoOthers.push(ab);
        }
      }
      //no we have segments to deal with
      if(cursetItem.length===0)cursetItem = minimalsegsIfNoOthers; //if no valid segmens were found, but there are some though
      if(cursetItem.length>0) allsegs.push({t:item.t,segs:cursetItem,layertype:item.layertype});
    }
    return allsegs;
  },
}

module.exports = dataReader;
