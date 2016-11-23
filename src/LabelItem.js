/*
modlue to create labelItems convenient for labelling and calculation
*/

var geomEssentials = require('./geomEssentials.js');

module.exports = {
  /**
  a factory function for label items
  @param {String} text:
  @param {String} style: text style
  @param {L.Point} txSize: size of bounding box for txNode
  @param {L.Layer} layer: a feature (Marker, Polyline, Path) to aquire data
  */
  labelItem:function(text,style,txSize,layer,hostArray){

    var minTolerativeDistancePx = 5; //const

    var basic_item= {
      data:[],
      text:text,
      style:style,
      txSize:txSize,
      layer:layer,
      host:hostArray,
      _itemPoly:false, //all available textlabel positions for this label comin in 1 polygon
      ignoreWhileLabel:false,
      index:function(){
        return this.host.lastIndexOf(this);
      },
      readData:function(){return false}, //a method stub,
      layer_type:function(){
        //TOFIX for polygon
        if(!this._layer_type)this._layer_type = (this.layer._parts.length>0)?1:0;
        return this._layer_type;
      },

      _getBoundary:function(){return false;}, //a method stub, to obtain polygon with all postions
      applyFeatureData:function(){}, //a method stub

      /**
      get all available positions for this item. Depending on layer_type -> diff funcs.
      Used in clustering computation
      */
      getItemPoly:function(){
        if(!this._itemPoly){
          this._itemPoly =  this._getBoundary();
        }
        return this._itemPoly;
      }
    };

    //TODO add prototyping || classes to handle differenet approaches for pt, poly and lines
    //Not a very proper way to do such deal
    if(basic_item.layer_type()==0){
      return;
      basic_item.readData = function(){
        if(basic_item.layer.getLatLngs())
        basic_item.data=basic_item.layer._map.latLngToLayerPoint(basic_item.layer.getLatLngs()[0]); //so we adding only L.Point obj
      }
    }else{
      if(basic_item.layer._parts.length==0)return;
      basic_item.computed_lengths=[];
      basic_item.totalLength=0;
      //this give possibility to read all parts to separate items
      basic_item.readData=function(partIndex){ //to read consequently
        if(!partIndex){var partIndex=0;};
        var nextPart = partIndex;
        this.data = this.layer._parts[partIndex];
        this.partIndex=partIndex; //store this to have ability to compute totalOffset, for example
        //while(nextPart<this.layer._parts.length){
        // NEEDS TO BE FINISHED
        var nextPart=partIndex+1;
        if(nextPart<this.layer._parts.length){
          var notClonedNow=true;
          while((this.layer._parts[partIndex][this.layer._parts[partIndex].length-1].distanceTo(this.layer._parts[nextPart][0])<minTolerativeDistancePx)
                 &&(nextPart+1<this.layer._parts.length)){
            if(notClonedNow)this.data = this.layer._parts[partIndex].slice(0);
            Array.prototype.push.apply(this.data, this.layer._parts[nextPart].slice(0));
            partIndex++;
            nextPart++;
          }
          return nextPart;
        }else return false;
      }

      basic_item.segCount = function(){return this.data.length -1};

      /**
      Get a segment from polyline part by it's offset
      @param {Number} offset: na offset for the polyline
      @returns {Array} : index of start point of segment and dist which is offset from start of the line to the end of found segment
      */
      basic_item.getSegmentIdxAndDistByOffset=function(offset){
        return geomEssentials.getSegmentIdxAndDistByOffset(offset,this.data,this.computed_lengths);
      }

      basic_item._getBoundary = function(){
        return geomEssentials.computeLineBoundaryPolygon(this.data,this.txSize.y);
      }

      /**
      Calculates total length for this polyline on screen, and lengths of each segments with their angles
      @param {labelItem} item: an item to get above data to
      */
      basic_item.applyFeatureData=function(){
        this.totalLength=0;
        this.computed_lengths = geomEssentials.computeSegmentsLengths(this.data);
        for(var k=0;k<this.computed_lengths.length;k++){
          this.totalLength+=this.computed_lengths[k];
        }
        this.ignoreWhileLabel=this.totalLength<this.txSize.x;
      }

    }

    return basic_item;
  },

  candidatePosition:function(offset_or_origin,item){
    return {
      _item:item,
      offset_or_origin:offset_or_origin,
      _poly:false,
      all_items_index:function(){
        return this._item.index();
      },

      /**
      Used for calculationg overlaps for text along path (textPath SVG).
      TODO avoid or smooth sharp angles to keep text fully visible
      @param {Number} start_offset: global offset for this polyline (item), same as used in rendering
      @param {LabelItem} item:
      @returns {Array} : a poly bounding curved text
      */
      _computePolyForLine:function(){
        var subPolyline = geomEssentials.extractSubPolyline(
          this.offset_or_origin,
          this.offset_or_origin + this._item.txSize.x,
          this._item.data,this._item.computed_lengths);
        return geomEssentials.computeLineBoundaryPolygon(subPolyline,item.txSize.y);
      },

      /**
      common function switch for computing poly for different layer_types

      */
      _computePoly:function(){
        switch(item.layer_type()){
          case 0:break;
          case 1:{
              this._poly = this._computePolyForLine();
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
