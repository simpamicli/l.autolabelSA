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
              //TOOO [readData] if last point of prev part is equal to fisrt of next part -> use one item for these
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
    var i=all_items.length-1;
    while(i>=0)
    {
      all_items[i].applyFeatureData();
      if(all_items[i].ignoreWhileLabel)all_items.splice(i,1); //remove if item does not suit it's label for some reason
      i--;
    }
    return true;
  },
}

module.exports = dataReader;
