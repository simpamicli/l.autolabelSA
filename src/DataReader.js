/**
Module to extract sufficient info to label data on the map
*/

"use strict";

var DOMEssentials = require("./DOMEssentials.js");
var geomEssentials = require("./geomEssentials.js");

var dataReader = {
  /**
  creates an array of features's segments for each feature  of layers2label's layers on screen along with SVG text corresponding to
  @returns [Array] returns an array with values : {t:{content_node:SVG textnode},parts:feature parts,layertype}, then, in next funcs we add apoly param to t object, ir, its bounding polygon, layertype = 0 marker, 1 polyline, 2 polygon
  */
  readDataToLabel:function(){
    var pt  =[];
    //this._map=map_to_add;
    if(this._map){
      //var bounds_to_contain_labels = geomEssentials.getBoundsWithoutPadding(this._map,0.9); // if needed
      for(var i in this._map.autoLabeler._layers2label)
      if(this._map.getZoom()>this._map.autoLabeler._layers2label[i]._al_options.zoomToStartLabel)
      {
        var lg=this._map.autoLabeler._layers2label[i];
        var map_to_add = this._map;
        lg.eachLayer(function(layer){
          if(layer.feature)
          if(layer.feature.properties[lg._al_options.propertyName]){
            var node =DOMEssentials.createSVGTextNode(layer.feature.properties[lg._al_options.propertyName],lg._al_options.labelStyle);
            var poly = DOMEssentials.getBoundingBox(map_to_add,node); //compute ortho aligned bbox for this text, only once, common for all cases
            var layer_type = 0;
            var centerOrParts=[]; //array for storing visible segments or centres (for points)
            if(layer instanceof L.Polyline || layer instanceof L.Polygon){ //polyline case
                if(layer._parts.length>0){ //so, line is visible on screen and has property to label over it
                  layer_type = layer instanceof L.Polygon?2:1; //0 goes to marker or circlemarker
                  centerOrParts=layer._parts; //for polygon
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
  @param {Set} options: options are:  {float} minSegLen: if segment length less than this, it is skipped except it is the only one for current polyline, {integer} maxlabelcount: if more labels in ptcollection, then do nothing
  */
  prepareCurSegments:function(ptcollection,options){
    options = options || {};
    options.maxlabelcount=options.maxlabelcount || 100;
    if(ptcollection.length>options.maxlabelcount){ //FIXME [prepareCurSegments] not aproper way to do things, to overcome two time rendering while zooming
      this._map._dodebug('too much labels to compute('+ptcollection.length+'>'+options.maxlabelcount+')');
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
      //now it is only fo lines
      if(item.layertype==1){
        var to_all_segs = this._obtainLineFeatureData(item);
        if(to_all_segs.segs.length>0)allsegs.push(to_all_segs);
      }
    }
    return allsegs;
  },

  _obtainLineFeatureData:function(item){
    var cursetItem=[]; //set of valid segments for this item
    var labelLength = item.t.poly[2][0];
    for(var j=0;j<item.parts.length;j++){ //here we aquire segments to label
      var curpart = item.parts[j];
      for(var k=1;k<curpart.length;k++){
        var a = curpart[k-1];
        var b = curpart[k];
        var ab = [a,b];
        var ablen = a.distanceTo(b); //compute segment length only once
        var what_to_push ={seg:ab,seglen:ablen};
        if(ablen>0)cursetItem.push(what_to_push);
        // cursetItem.push(what_to_push);
      }
    }
    var to_all_segs = {t:item.t,layertype:item.layertype};
    to_all_segs.segs=cursetItem;
    if(to_all_segs.segs.length>0){
      to_all_segs.segs.sort(
        function(s1,s2){ //by segments length, first are small
          return s1.seglen-s2.seglen;
        });
        var total_length=0;
        for(var m=0;m<to_all_segs.segs.length;m++)total_length+=to_all_segs.segs[m].seglen;
        to_all_segs.total_length=total_length;
    }
    return to_all_segs;
  },

  _getLineSegmentBoundaryPoly:function(seg){
    //TODO [_getLineSegmentBoundaryPoly]
  },

  prepareGeneralConflictGraph:function(all_segs){
    //TODO[prepareGeneralConflictGraph]
  }
}

module.exports = dataReader;
