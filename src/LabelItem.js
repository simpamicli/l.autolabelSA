module.exports = {
  labelItem:function(txNode,txSize,layer){
    var basic_item= {
      txNode:txNode,
      txSize:txSize,
      layer:layer,
      readData:function(){},
      layer_type:function(){
        if(layer instanceof  L.CircleMarker || L.Marker)return 0;
        if(layer instanceof L.Polyline)return 1;
        if(layer instanceof L.Polygon)return 2;
      }
    };

    if(basic_item.layer_type()==0){
      basic_item.data=L.Map.latLngToLayerPoint(layer.getLatLngs()); //so we adding only L.Point obj
    }else{
      basic_item.readData=function(partIndex){ //to read consequently
        if(!partIndex){var partIndex=0;};
        this.data = this.layer._parts[partIndex];
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
