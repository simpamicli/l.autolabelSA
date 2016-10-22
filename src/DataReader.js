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
    var pt  =[],count=0;
    if(this._map){
      for(var i in this._map.autoLabeler._layers2label)
      if(this._map.getZoom()>this._map.autoLabeler._layers2label[i]._al_options.zoomToStartLabel)
      {
        var lg=this._map.autoLabeler._layers2label[i],
            map_to_add = this._map;
        lg.eachLayer(function(layer){
          if(layer.feature)
          if(layer.feature.properties[lg._al_options.propertyName]){
            var text=layer.feature.properties[lg._al_options.propertyName],
                style=lg._al_options.labelStyle,
                node = DOMEssentials.createSVGTextNode(text,style),
                size = DOMEssentials.getBoundingBox(map_to_add,node); //compute ortho aligned bbox for this text, only once, common for all cases
            if(layer._path)if(layer._parts.length>0){
              var id = 'pathautolabel-' + L.Util.stamp(layer);
              layer._path.setAttribute('id',id);
              layer.feature.properties.alabel_offset="";
              count++;
            }
            var firstItem = itemFactory.labelItem(text,style,size,layer,pt)
            if(firstItem){
              var nextPartIndex=firstItem.readData();
              pt.push(firstItem);
              while(nextPartIndex){
                var item = itemFactory.labelItem(text,style,size,layer,pt); //create node template
                nextPartIndex=item.readData(nextPartIndex);
                pt.push(item);
              }
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
      this._map.autoLabeler._dodebug('too much OR no labels to compute('+all_items.length+')');
      return false;
    }
    for(var i=0;i<all_items.length;i++){
      var item = all_items[i];
      if(item.layer_type()==0){//if point -> do nothing.
        continue;
      }
      //else compute for lines and polygons, now it is only fo lines
      if(item.layer_type()==1){
        this._applyLineFeatureData(item); //in case where two or move separate polylines generated for original polyline while rendering (imagine big W cutted by screen iwndow)
      }
    }
    return true;
  },

  /**
  Calculates total length for this polyline on screen, and lengths of each segments with their angles
  @param {labelItem} item: an item to get above data to
  */
  _applyLineFeatureData:function(item){ //calculate some data once to increase performance
      item.totalLength=0;
      item.computed_lengths = geomEssentials.computeSegmentsLengths(item.data);
      for(var k=0;k<item.computed_lengths.length;k++){
        item.totalLength+=item.computed_lengths[k];
      }
  }
}

module.exports = dataReader;
