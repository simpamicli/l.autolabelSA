var DOMEssentials = require('./DOMEssentials.js');
var geomEssentials = require('./geomEssentials.js');
var simulatedAnnealing = require('./simulatedAnnealing.js');
var dataReader = require('./DataReader.js');

L.autoLabeler = function(map)
{
    var AL={
    _map:map,
    _nodes:[], //an array for storing SVG node to draw while autolabelling
    _layers2label:[], //an array to know which layergroups are to label
    options:{}, //autolabel options
    _autoLabel:false, //to determine if autolabelling is set for this map

    hasLayer:function(layer){
      return this._layers2label.indexOf(layer)!=-1;
    },

    addLayer:function(layer){
      if(!this.hasLayer(layer))this._layers2label.push(layer);
    },

    remLayer:function(layer){
      var ind=this._layers2label.indexOf(layer);
      if(ind>=0){
        this._layers2label.splice(ind,1);
      }
      return ind>=0;
    },

    /**
    set global options for auto-labelling
    */
    setAutoLabelOptions: function (opts) {
      this.options = opts || {};
      this.options.showBBoxes = opts.showBBoxes ||false; //display bounding boxes around texts
      this.options.debug = opts.debug || true; //show debug info in hte cons
      this.options.labelsDelay = opts.labelsDelay || 1000; //a time after update event of renderer when labelling should start, if zero - errors while zooming
      this.options.checkLabelsInside = opts.checkLabelsInside || true; //re-clip all segments to entirely fit map window without padding, disabling increases performance, but some labels maybe invisible due to padding of renderer
      this.options.zoomToStartLabel = opts.zoomToStartLabel || 13; //if map zoom lev is below this, do not show labels
      this.options.minimizeTotalOverlappingArea = opts.minimizeTotalOverlappingArea || false; //if true, minimize not the count of overlapping labels, but instead their total overlapping area
      this.options.deleteIfNoSolution = opts.deleteIfNoSolution || false; //TODO [setAutoLabelOptions] if no solution can be achieivd, delete some of the labels, which are overlapping, based on their layer al_options.priority or random if equal
      this.options.doNotShowIfSegIsTooSmall = opts.doNotShowIfSegIsTooSmall || false; //TODO [setAutoLabelOptions] if segment length is less then textlength of text, do not show this text
      this.options.annealingOptions = opts.annealingOptions || {};
    },

    /**
    toggles autolabeling
    */
    toggleAutoLabelling:function(){ //this not tested yet
      if(this._autoLabel)this.disableAutoLabel();else this.enableAutoLabel();
    },

    /**
    enable autolabeling
    */
    enableAutoLabel:function(){
      if(!this._map){
        this._dodebug('no map attached');
        return;
      }
      if(!this._map.options.renderer){
        this._dodebug('renderer is invalid');
        return;
      }
      this.setAutoLabelOptions(this.options);
      this._map.options.renderer.on("update",this._apply_doAutoLabel);
      this._map.on("zoomstart",function(){this._zoomstarttrig=1});
      this._map.on("zoomend",function(){this._zoomstarttrig=0});
      this._autoLabel = true;
    },

    //to check if zoomstart event is fired to prevent autolabeling BEFORE zoomend
    _zoomstarttrig:0,

    //id of timeout after which AutoLabeling should be done each time - used to stop timer in case of changed map state BEFORE autolabelling was performed
    _ctimerID:-1,

    /**
    disable autolabeling for this map
    */
    disableAutoLabel:function(){
      this._map.options.renderer.off("update",this._apply_doAutoLabel);
      this._autoLabel=false;
    },

    /*
    beacuse we using update event of renderer, here we switching to map context and handling two-time update event of SVG renderer
    */
    _apply_doAutoLabel:function(){
      if(this._map.autoLabeler._ctimerID!=-1)clearTimeout(this._map.autoLabeler._ctimerID);
      if(this._map.autoLabeler._zoomstarttrig==0){
        var al = this._map.autoLabeler;
        var lDelay = this._map.autoLabeler.options.labelsDelay;
        this._map.autoLabeler._ctimerID=setTimeout(function(){al._doAutoLabel()},lDelay);
      }
      this._map.autoLabeler._clearNodes();
    },

    _dodebug:function(message){
      if(this.options.debug)console.log(message);
    },


    /**
    this function obtains visible polyline segments from screen and computes optimal positions and draws labels on map
    */
    _doAutoLabel:function() {
      if(!this._autoLabel)return; //nothing to do here
      if(this._map.getZoom()>this.options.zoomToStartLabel){
        dataReader._map=this._map;
        var pt  =dataReader.readDataToLabel(this._map) //array for storing paths and values
        var allsegs=dataReader.prepareCurSegments(pt,{maxlabelcount:80});
        if(allsegs.length==0){
          this._clearNodes();
          return;
        }
        simulatedAnnealing.processOptions({});
        curset = simulatedAnnealing.getInitialRandomState(allsegs);
        this._renderNodes(curset);
        // simulatedAnnealing.perform(allsegs,this.options.annealingOptions,this._renderNodes,this);
      }else{
        this._clearNodes();
      }
    },

    /**
    for test purposes now, creates a polygon node useing poly Array of points
    */
    _createPolygonNode:function(poly,highlited){
      var node = L.SVG.create('polygon');
      var points='';
      for(var i=0;i<poly.length;i++){
        points+=poly[i][0]+','+poly[i][1]+' ';
      }
      node.setAttribute('points', points.trim());
      if(highlited){
        this._dodebug('overlaps');
        node.setAttribute('style','fill: yellow; fill-opacity:1; stroke: black;');
      }
      else node.setAttribute('style','fill: yellow; fill-opacity:0.1; stroke: black;');
      return node;
    },

    /**
    clears label on the screen
    */
    _clearNodes:function() {
    var svg = this._map.options.renderer._container;  //to work with SVG
      for(var i=0;i<this._nodes.length;i++){//clear _nodes on screen
        svg.removeChild(this._nodes[i]);
      }
      this._nodes=[];
      this._dodebug("Cleared nodes");
    },

    /**
    renders computed labelset on the screen via svg
    */
    _renderNodes:function(labelset){
      var svg =  this._map.options.renderer._container;  //to work with SVG
      this._clearNodes(); //clearscreen
      for(var m in labelset){
        var node = labelset[m].t.content_node;
        var x = labelset[m].pos.x;
        var y = labelset[m].pos.y;
        node.setAttribute('x', x);
        node.setAttribute('y', y);
        var transform ='rotate('+ Math.floor(labelset[m].a)+','+Math.floor(x)+','+Math.floor(y)+')';
        transform = transform.replace(/ /g, '\u00A0');
        node.setAttribute('transform',transform);
        svg.appendChild(node);
        this._nodes.push(node);//add this labl to _nodes array, so we can erase it from the screen later
        if(this.options.showBBoxes){
          //here for testing purposes
          var polynode = this._createPolygonNode(labelset[m].poly,labelset[m].ovelaps);
          svg.appendChild(polynode);
          this._nodes.push(polynode); //add this polygon to _nodes array, so we can erase it from the screen later
        }
      }
    }
  }
  return AL;
}

module.exports = L.autoLabeler;
