/*
modlue to create labelItems convenient for labelling and calculation
*/

var geomEssentials = require('./geomEssentials.js');

var minTolerativeDistancePx = 5; //const

var layerType = function(layer){
  return (layer instanceof L.Polyline)?1:
         (layer instanceof L.Polygon)?2:
         0; //Marker || CircleMarker
}

var BasicMixin = {
  data:[],
  text:'',
  style:'',
  txSize:0,
  layer:null,
  host:null,
  _itemPoly:false, //all available textlabel positions for this label comin in 1 polygon
  ignoreWhileLabel:false,
  isDegenerate:false,
  index:function(){
    return this.host.lastIndexOf(this);
  },
  layer_type:function(){
    //TOFIX for polygon
    if(!this._layer_type)this._layer_type = layerType(this.layer);
    return this._layer_type;
  },

  /**
  get all available positions for this item. Depending on layer_type -> diff funcs.
  Used in clustering computation
  */
  getItemPoly:function(){
    if(!this._itemPoly){
      this._itemPoly =  this._getBoundary();
    }
    return this._itemPoly;
  },
  initializeBase:function(options){
    this.text=options.text; this.style = options.style; this.layer = options.layer; this.host = options.hostArray; this.txSize = options.txSize;
  }
}

var PointItem = L.Class.extend({
  initialize:function(options){
    this.initializeBase(options);
  },

  _getBoundary: function(){
    return geomEssentials.getPointTextDomain(this.data,this.txSize);
  },

  applyFeatureData:function(){
    //TODO
  },

  readData:function(){
    var ll = this.layer.getLatLng();
    this.data = this.layer._map.latLngToLayerPoint(ll);
    this._simplePoly = geomEssentials.getSimplePolyText(this.data,this.txSize);
  }
})

PointItem.include(BasicMixin);

var LineItem = L.Class.extend({
  initialize:function(options){
    this.initializeBase(options)
    this.computed_lengths=[];
    this.totalLength=0;
    if(this.layer._parts.length===0)this.isDegenerate = true;
  },

  _getBoundary: function(){
    return geomEssentials.computeLineBoundaryPolygon(this.data,this.txSize.y);
  },

  /**
  Calculates total length for this polyline on screen, and lengths of each segments with their angles
  @param {labelItem} item: an item to get above data to
  */
  applyFeatureData:function(){
    this.totalLength=0;
    this.computed_lengths = geomEssentials.computeSegmentsLengths(this.data);
    for(var k=0;k<this.computed_lengths.length;k++){
      this.totalLength+=this.computed_lengths[k];
    }
    this.ignoreWhileLabel=this.totalLength<this.txSize.x;
  },

  //orig part
  readData:function(partIndex){ //to read consequently
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
  },

  segCount:function(){return this.data.length -1},

  /**
  Get a segment from polyline part by it's offset
  @param {Number} offset: na offset for the polyline
  @returns {Array} : index of start point of segment and dist which is offset from start of the line to the end of found segment
  */
  getSegmentIdxAndDistByOffset:function(offset){
    return geomEssentials.getSegmentIdxAndDistByOffset(offset,this.data,this.computed_lengths);
  }
});

LineItem.include(BasicMixin);

module.exports = {
  /**
  a factory function for label items
  @param {String} text:
  @param {String} style: text style
  @param {L.Point} txSize: size of bounding box for txNode
  @param {L.Layer} layer: a feature (Marker, Polyline, Path) to aquire data
  */
  labelItem:function(text,style,txSize,layer,hostArray){
    var ltype= layerType(layer);
    var opts = {text:text,style:style,txSize:txSize,layer:layer,hostArray:hostArray};
    var result=false;
    switch (ltype) {
      case 0:
        result = new PointItem(opts);
        break;
      case 1:
        result= new LineItem(opts);
        break;
    }
    return (!result.isDegenerate)?result:false;
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

      _computePolyForPoint:function(){
        return geomEssentials.movePolyByAdding(this._item._simplePoly,this.offset_or_origin);
      },

      /**
      common function switch for computing poly for different layer_types
      */
      _computePoly:function(){
        switch(this._item.layer_type()){
          case 0:{
            this._poly = this._computePolyForPoint();
            break;
          }
          case 1:{
              this._poly = this._computePolyForLine();
              break;
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
