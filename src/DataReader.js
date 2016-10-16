/**
Module to extract sufficient info to label data on the map
*/

"use strict";

var DOMEssentials = require("./DOMEssentials.js");
var geomEssentials = require("./geomEssentials.js");
var itemFactory = require('./LabelItem.js');

var dataReader = {
  /**
  creates an array of features's segments for each feature  of layers2label's layers on screen along with SVG text corresponding to
  @returns [Array] returns an array with values : {t:{content_node:SVG textnode},parts:feature parts,layertype}, then, in next funcs we add apoly param to t object, ir, its bounding polygon, layertype = 0 marker, 1 polyline, 2 polygon
  */
  readDataToLabel:function(){
    var pt  =[];
    if(this._map){
      for(var i in this._map.autoLabeler._layers2label)
      if(this._map.getZoom()>this._map.autoLabeler._layers2label[i]._al_options.zoomToStartLabel)
      {
        var lg=this._map.autoLabeler._layers2label[i];
        var map_to_add = this._map;
        lg.eachLayer(function(layer){
          if(layer.feature)
          if(layer.feature.properties[lg._al_options.propertyName]){
            var node =DOMEssentials.createSVGTextNode(layer.feature.properties[lg._al_options.propertyName],lg._al_options.labelStyle);
            var size = DOMEssentials.getBoundingBox(map_to_add,node); //compute ortho aligned bbox for this text, only once, common for all cases
            var firstItem = itemFactory.LabelItem(node,size,layer);
            var nextPartIndex=firstItem.readData();
            pt.push(firstItem);
            while(nextPartIndex){
              var item = itemFactory.LabelItem(node,size,layer); //create node template
              nextPartIndex=item.readData(nextPartIndex);
              pt.push(item);
            }
          }
        });
      }
    }
    return pt;
  },

  /**
  extracts good segments from available polyline parts and converts to use in next procedures of pos estimation
  @param {Array} all_items:
  @param {Set} options: options are:  {integer} maxlabelcount: if more labels in all_items, then do nothing
  */
  prepareCurSegments:function(all_items,options){
    options = options || {};
    options.maxlabelcount=options.maxlabelcount || 100;
    if(all_items.length>options.maxlabelcount || all_items.length==0){
      this._map._dodebug('too much OR no labels to compute('+all_items.length+')');
      return false;
    }
    for(var i=0;i<all_items.length;i++){
      var item = all_items[i];
      if(item.layer_type()==0){//if point -> do nothing.
        continue;
      }
      //else compute for lines and polygons
      //now it is only fo lines
      if(item.layertype==1){
        this._applyLineFeatureData(item); //in case where two or move separate polylines generated for original polyline while rendering (imagine big W cutted by screen iwndow)
      }
    }
    return true;
  },

  _applyLineFeatureData:function(item){ //calculate some data once to increase performance
    item.specific.totalItemLength=0;
    for(var j=0;j<item.data.length;j++){ //here we aquire segments to label, iterate through oarts
      var curpart = item.data[j], curPartSegData=[], curPartLen=0;
      for(var k=1;k<curpart.length;k++){
        var a = curpart[k-1], b = curpart[k];
        var ablen = a.distanceTo(b); //compute segment length only once
        var abangle = geomEssentials.computeAngle(a,b,true); //same for angles
        curPartLen+=ablen;
        curPartSegData.push({seglen:ablen,angle:abangle});
      }
      item.complement.push({segdata:curPartSegData,partLength:curPartLen}); //for this part
      item.specific.totalItemLength+=curPartLen;
    }
  },

  _getLineSegmentBoundaryPoly:function(item){
    //TODO [_getLineSegmentBoundaryPoly]
    // var labelLength = item.t.poly[2][0];
  },

  prepareGeneralConflictGraph:function(all_segs){
    //TODO[prepareGeneralConflictGraph]
  }
}

module.exports = dataReader;
