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
  labelItem:function(txNode,txSize,layer,hostArray){
    var basic_item= {
      data:[],
      txNode:txNode,
      txSize:txSize,
      layer:layer,
      host:hostArray,
      index:function(){
        return host.lastIndexOf(this);
      },
      readData:function(){return false}, //a method stub
      layer_type:function(){ //return a layer type, where 0 is point, 1 is line, 2 is poly
        // if(!this._type){
        //   if(layer instanceof  L.CircleMarker || L.Marker){
        //     this._type= 0;
        //   }else if(layer instanceof L.Polyline){
        //     this._type= 1;
        //   }else if(layer instanceof L.Polygon){
        //     this._type= 2;
        //   }
        // }
        // return this._type;
        return (layer._parts.length>0)?1:0;
      }
    };

    if(basic_item.layer_type()==0){
      return;
      basic_item.readData = function(){
        if(basic_item.layer.getLatLngs())
        basic_item.data=basic_item.layer._map.latLngToLayerPoint(basic_item.layer.getLatLngs()[0]); //so we adding only L.Point obj
      }
    }else{
      //this give possibility to read all parts to separate items
      basic_item.readData=function(partIndex){ //to read consequently
        if(!partIndex){var partIndex=0;};
        this.data = this.layer._parts[partIndex];
        this.partIndex=partIndex; //store this to have ability to compute totalOffset, for example
        var nextPart=++partIndex;
        if(nextPart<this.layer._parts.length)return nextPart;else return false;
      }
    }

    if(basic_item.layer_type()==1){

      if(basic_item.layer._parts.length==0)return;

      basic_item.segdata=[];
      basic_item.totalLength=0;
      basic_item.getSegment = function(index,no_segdata){
        var a = this.data[index], b = this.data[index+1];
        if(ano_segdata)return [a,b];
        else return [a,b,this.segdata[index]];
      }
      basic_item.segCount = function(){
        return this.segdata.length;
      }

      /**
      Get a segment from polyline part by it's offset
      @param {Number} offset: na offset for the polyline
      @param {labelItem} item: item
      @returns {Object} : index of segment and dist which is offset from start of the line to the end of found segment
      */
      basic_item.getSegmentIdxAndDistByOffset=function(offset){
        var cdist=0;
        for(var i=0;i<this.segCount();i++){
          cdist+=this.getSegment(i)[2];
          if(offset<cdist){
            return {index:i,dist:cdist};
          }
        }
        return {index:i,dist:cdist};
      }

      /**
      based on https://blog.dotzero.ru/weighted-random-simple/
      get a random element from segments array of the item, assuming it is sorted lengths ascending order
      probability is higher for longer segment
      */
      basic_item.getIndexBasedOnTotalLengthRandom=function(){
        var random_pos = Math.random()*this.totalLength; //get a position random for all segments of this polyline visible on the screen
        //obtain and index of segment, to which belongs this position, it is assumed tha segments are sorted by length
        var clen=0;
        for(var i=0;i<this.segCount();i++){
          clen+=this.segdata[i].seglen;
          if(clen>random_pos)break;
        }
        return i;
      }
    }
    return basic_item;
  },

  candidatePosition:function(offset_or_origin,item){
    return {
      _item:item,
      offset_or_origin:offset_or_origin,
      _poly:false,
      all_items_index:function(){return item.index},

      /**
      Used for calculationg overlaps for text along path (textPath SVG).
      @param {Number} start_offset: global offset for this polyline (item), same as used in rendering
      @param {LabelItem} item:
      @returns {Array} : a poly bounding curved text
      */
      _computePolyForLine:function(start_offset,item){
        var final_offset = start_offset + item.txSize.x;
        var end_offset=(final_offset<=item.totalLength)?final_offset:item.totalLength;
        return geomEssentials.computeLineBoundaryPolygon(start_offset,end_offset,item);
      },

      /**
      common function switch for computing poly for different layer_types
      */
      _computePoly:function(){
        switch(item.layer_type()){
          case 0:break;
          case 1:{
              this._poly = this._computePolyForLine(this.offset_or_origin,this._item);
            }
          case 2:break;
        }
      },

      poly:function(){
        if(!this._poly)this._computePoly();
        return this._poly;
      }
    }
  },

}
