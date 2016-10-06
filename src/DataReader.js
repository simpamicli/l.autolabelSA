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
      var bounds_to_contain_labels = geomEssentials.getBoundsWithoutPadding(this._map,0.9); // if needed
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
            var centerOrParts=[];
            if(layer instanceof L.Polyline || layer instanceof L.Polygon){ //polyline case
                if(layer._parts.length>0){ //so, line is visible on screen and has property to label over it
                  layer_type = layer instanceof L.Polygon?2:1; //0 goes to marker or circlemarker
                  //TEMPORARY TOFIX
                  if(layer_type==1 && this._map._al_options.checkLabelsInside){
                      centerOrParts = geomEssentials.clipClippedPoints(layer._parts,bounds_to_contain_labels);
                  }
                  else centerOrParts=layer._parts; //for polygon
                }
              }
            else if (layer instanceof L.CircleMarker || L.Marker){
              centerOrParts = this._map.latLngToLayerPoint(layer.getLatLngs()); //so we adding only L.Point obj
            }

            if(centerOrParts.length>0){
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
      //TODO[prepareCurSegments]IMPORTANT clip _parts angain to about 0.9 size of screen bbox
      //now it is only fo lines
      if(item.layertype==1){
        var cursetItem=[]; //set of valid segments for this item
        var too_small_segments=[]; //set of segment which length is less the label's lebgth of corresponding feature
        var labelLength = item.t.poly[2][0];
        for(var j=0;j<item.parts.length;j++){ //here we aquire segments to label
          var curpart = item.parts[j];
          for(var k=1;k<curpart.length;k++){
            var a = curpart[k-1];
            var b = curpart[k];
            var ab = [a,b];
            var ablen = a.distanceTo(b); //compute segment length only once
            var what_to_push ={seg:ab,seglen:ablen};
            if(ablen>labelLength)cursetItem.push(what_to_push);else too_small_segments.push(what_to_push);
          }
        }
      }

      var to_all_segs = {t:item.t,layertype:item.layertype};
      if(cursetItem.length>0)to_all_segs.segs=cursetItem;else to_all_segs.segs=too_small_segments;
      allsegs.push(to_all_segs);
    }
    return allsegs;
  },
}

module.exports = dataReader;
