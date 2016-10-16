/*
modlue to create labelItems convenient for labelling and calculation
*/

module.exports = {
  /**
  a factory function for label items
  @param {TextNode} txNode: SVG TextNode
  @param {L.Point} txSize: size of bounding box for txNode
  @param {L.Layer} layer: a feature (Marker, Polyline, Path) to aquire data
  */
  labelItem:function(txNode,txSize,layer){
    var basic_item= {
      txNode:txNode,
      txSize:txSize,
      layer:layer,
      readData:function(){}, //a method stub
      layer_type:function(){ //return a layer type, where 0 is point, 1 is line, 2 is poly
        if(layer instanceof  L.CircleMarker || L.Marker)return 0;
        if(layer instanceof L.Polyline)return 1;
        if(layer instanceof L.Polygon)return 2;
      }
    };

    if(basic_item.layer_type()==0){
      basic_item.data=L.Map.latLngToLayerPoint(layer.getLatLngs()); //so we adding only L.Point obj
    }else{
      //this give possibility to read all parts to separate items
      basic_item.readData=function(partIndex){ //to read consequently
        if(!partIndex){var partIndex=0;};
        this.data = this.layer._parts[partIndex];
        this.partIndex=partIndex; //store this to have ability to compute totalOffset, for example
        var nextPart=partIndex++;
        if(nextPart<this.layer._parts.length)return nextPart;
      }
    }

    if(basic_item.layer_type()==1){
      basic_item.segdata=[];
      basic_item.totalLength=0;
      basic_item.getSegment = function(index){
        var a = this.data[index-1], b = this.data[index];
        return [a,b,this.segdata[index-1]];
      }
    }
    return basic_item;
  },
  resItem:function(item_ind,offset_or_origin){
    return {
      item_ind:item_ind,
      offset_or_origin:offset_or_origin
    }
  },

}
