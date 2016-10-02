(function () {
  "use strict";

   //TODO [general] test with diffenrent files
   //TODO [general] add point and polygon labeling
   //TODO [general] add text along path support

  var DOMEssentials = require('./DOMEssentials.js');
  var geomEssentials = require('./geomEssentials.js');
  var simulatedAnnealing = require('./simulatedAnnealing.js');
  var dataReader = require('./DataReader.js');


  var __onRemove = L.LayerGroup.prototype.onRemove;
  //to include in LabelGroup
  /** @namespace AutoLabelingSupport*/
  var AutoLabelingSupport = {
      /**
      handle removing layer from the map
      @memberof AutoLabelingSupport#
      */
      onRemove: function (map) {
      this.disableAutoLabel();
        __onRemove.call(this, map);
    },


    /**
     enable autolabeling for this layerGroup, additionally set the current_map variable if it is undefined and hooks label painting on moveend /zoomend events
     it adds this layerGroup to the _layers2label array, so _doAutoLabel function will know about this layerGroup
     @param {Object} options: labelStyle - css string to describe labels look, for now one for all layers in group, propertyName - a property from layer.feature.properties which we label on map
     @memberof AutoLabelingSupport#
    */
    enableAutoLabel:function(options){
      if(!this._map)return;
      if(!this._map._layers2label)return;
      this._al_options = options || {};
      this._al_options.labelStyle = options.labelStyle || "fill: lime; stroke: #000000;  font-size: 20px;"; //TODO [enableAutoLabel] add ability to set unique style for each feature
      this._al_options.propertyName = options.propertyName || "name";
      this._al_options.priority = options.priority || 0; //highest
      this._map._layers2label.push(this);
    },

    /**
    Obtain autlabelling state for this layerGroup
    @memberof AutoLabelingSupport#
    @returns {Boolean}
    */
    autoLabelEnabled:function(){
      if(!this._map._layers2label)return false;
      return this._map._layers2label.indexOf(this)!=-1;
    },

    /**
    disable autolabelling
    @memberof AutoLabelingSupport#
    */
    disableAutoLabel:function(){
      if(!this._map._layers2label){
        delete this._al_options;
        return;
      }
      var ind=this._map._layers2label.indexOf(this);
      if(ind>=0){
        this._map._layers2label.splice(ind,1);
        delete this._al_options;
      }
    }
  }

  //to include in Map
  /** @namespace MapAutoLabelSupport*/
  var MapAutoLabelSupport = {
    _nodes:[], //an array for storing SVG node to draw while autolabelling
    _layers2label:[], //an array to know which layergroups are to label
    _al_options:{}, //autolabel options for this map
    //_al_timerID:-1, //variable to store current timer ID of simulated annealing timer - used for terminating annealing job
    _autoLabel:false, //to detrmine if autolabelling is set for this map
    /**
    set global options for auto-labelling
    @param {OBject} opts: see code
    @memberof MapAutoLabelSupport#
    */
    setAutoLabelOptions: function (opts) {
      this._al_options = opts || {};
      this._al_options.showBBoxes = opts.showBBoxes ||false; //display bounding boxes around texts
      this._al_options.debug = opts.debug || true; //show debug info in hte cons
      this._al_options.zoomToStartLabel = opts.zoomToStartLabel || 13; //if map zoom lev is below this, do not show labels
      this._al_options.minimizeTotalOverlappingArea = opts.minimizeTotalOverlappingArea || false; //if true, minimize not the count of overlapping labels, but instead their total overlapping area
      this._al_options.deleteIfNoSolution = opts.deleteIfNoSolution || false; //TODO [setAutoLabelOptions] if no solution can be achieivd, delete some of the labels, which are overlapping, based on their layer al_options.priority or random if equal
      this._al_options.doNotShowIfSegIsTooSmall = opts.doNotShowIfSegIsTooSmall || false; //TODO [setAutoLabelOptions] if segment length is less then textlength of text, do not show this text
    },


    /**
    toggles autolabeling
    @memberof MapAutoLabelSupport#
    */
    toggleAutoLabelling:function(){ //this not tested yet
      if(this._autoLabel)this.disableAutoLabel();else this.enableAutoLabel();
    },
    /**
    enable autolabeling for this map
    @memberof MapAutoLabelSupport#
    */
    enableAutoLabel:function(){
      if(!this.options.renderer){
        this._dodebug('renderer is invalid');
        return;
      }
      this.setAutoLabelOptions(this._al_options);
      //this.on("zoomend",this._apply_doAutoLabel);
      this.options.renderer.on("update",this._apply_doAutoLabel);
      this.on("zoomstart",function(){this._zoomstarttrig=1});
      this.on("zoomend",function(){this._zoomstarttrig=0});
      this._autoLabel = true;
    },

    //to check if zoomstart event is fired to prevent autolabeling BEFORE zoomend
    _zoomstarttrig:0,

    //id of timeout after which AutoLabeling should be done each time - used to stop timer in case of changed map state BEFORE autolabelling was performed
    _ctimerID:-1,
    /**
    disable autolabeling for this map
    @memberof MapAutoLabelSupport#
    */
    disableAutoLabel:function(){
      this.options.renderer.on("update",this._apply_doAutoLabel);
      //this.off("zoomend",this._apply_doAutoLabel);
      //._resetView = __resetView;
      //this.off("moveend ",this._doAutoLabel);
      this._autoLabel=false;
    },

    /*
    beacuse we using update event of renderer, here we switching to map context and handling two-time update event of SVG renderer
    */
    _apply_doAutoLabel:function(){
      if(this._map._ctimerID!=-1)clearTimeout(this._map._ctimerID);
      if(this._map._zoomstarttrig==0){
        var _this=this._map;
        this._map._ctimerID=setTimeout(function(){_this._doAutoLabel()},1000);
      }
      this._map._clearNodes();
    },

    _dodebug:function(message){
      if(this._al_options.debug)console.log(message);
    },

    /**
    this function obtains visible polyline segments from screen and computes optimal positions and draws labels on map
    TODO [_doAutoLabel] add populateOkSegments func
    @memberof MapAutoLabelSupport#
    */
    _doAutoLabel:function() {
      if(!this._autoLabel)return; //nothing to do here
      if(this.getZoom()>this._al_options.zoomToStartLabel){
        dataReader._map=this;
        var pt  =dataReader.readDataToLabel() //array for storing paths and values
        var allsegs=dataReader.prepareCurSegments(pt,{minSegLen:5,maxlabelcount:50});
        if(allsegs.length==0){
          this._clearNodes();
          return;
        }
        //TODO [_doAutoLabel] stop simulatedAnnealing from previous iteration before starting new
        //start new

        simulatedAnnealing.perform(allsegs,{},this._renderNodes,this);
      }else{
        this._clearNodes();
      }
    },

    /**
    for test purposes now, creates a polygon node useing poly Array of points
    @param {Array} poly
    @returns {SVGPolygon}
    @memberof MapAutoLabelSupport#
    */
    _createPolygonNode:function(poly){
      var node = L.SVG.create('polygon');
      var points='';
      for(var i=0;i<poly.length;i++){
        points+=poly[i][0]+','+poly[i][1]+' ';
      }
      node.setAttribute('points', points.trim());
      node.setAttribute('style','fill: yellow; fill-opacity:0.1; stroke: black;');
      return node;
    },

    /**
    clears label on the screen
    @memberof MapAutoLabelSupport#
    */
    _clearNodes:function() {
    var svg = this.options.renderer._container;  //to work with SVG
      for(var i=0;i<this._nodes.length;i++){//clear _nodes on screen
        svg.removeChild(this._nodes[i]);
      }
      this._nodes=[];
    },

    /**
    renders computed labelset on the screen via svg
    @memberof MapAutoLabelSupport#
    */
    _renderNodes:function(labelset){
      var svg =  this.options.renderer._container;  //to work with SVG
      this._clearNodes(); //clearscreen
      for(var m=0;m<labelset.length;m++){
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
        if(this._al_options.showBBoxes){
          //here for testing purposes
          var polynode = this._createPolygonNode(labelset[m].poly);
          svg.appendChild(polynode);
          this._nodes.push(polynode); //add this polygon to _nodes array, so we can erase it from the screen later
        }
      }
    }
  }

  L.LayerGroup.include(AutoLabelingSupport);
  L.Map.include(MapAutoLabelSupport);
})();
