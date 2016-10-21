var DOMEssentials = require('./DOMEssentials.js');
var geomEssentials = require('./geomEssentials.js');
var simulatedAnnealing = require('./simulatedAnnealing.js');
var dataReader = require('./DataReader.js');

L.AutoLabeler = L.Evented.extend(
 {
    _nodes:[], //an array for storing SVG node to draw while autolabelling
    _layers2label:[], //an array to know which layergroups are to label
    options:{
      showBBoxes:false, //display bounding boxes around texts
      debug:true,//show debug info in hte cons
      labelsDelay:1000,//a time after update event of renderer when labelling should start, if zero - errors while zooming
      checkLabelsInside:true,//re-clip all segments to entirely fit map window without padding, disabling increases performance, but some labels maybe invisible due to padding of renderer
      zoomToStartLabel:13,//if map zoom lev is below this, do not show labels
      minimizeTotalOverlappingArea:false, //if true, minimize not the count of overlapping labels, but instead their total overlapping area
      deleteIfNoSolution:false,//TODO [setAutoLabelOptions] if no solution can be achieivd, delete some of the labels, which are overlapping, based on their layer al_options.priority or random if equal
      doNotShowIfSegIsTooSmall:false, //TODO [setAutoLabelOptions] if segment length is less then textlength of text, do not show this text
      annealingOptions:{}
    }, //autolabel options

    _autoLabel:false, //to determine if autolabelling is set for this map

    initialize: function (map, options) {
      L.setOptions(this, options);
      this._map=map;
    },

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
        var all_items  =dataReader.readDataToLabel(this._map) //array for storing paths and values
        dataReader.prepareCurSegments(all_items,{maxlabelcount:80});
        if(all_items.length==0){
          this._clearNodes();
          return;
        }
        var curset = simulatedAnnealing.getInitialRandomState(all_items);
        this._renderNodes(curset);
        //simulatedAnnealing.perform(all_items,this.options.annealingOptions,this._renderNodes,this);
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
        points+=poly[i].x+','+poly[i].y+' ';
      }
      node.setAttribute('points', points.trim());
      if(highlited){
        node.setAttribute('style','fill: red; fill-opacity:0.3; stroke: black;');
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
        try{
          svg.removeChild(this._nodes[i]);
        }catch(err){
          console.log(err+'  '+i);
        }
      }
      this._nodes=[];
      // this._dodebug("Cleared nodes");
    },

    /**
    renders computed labelset on the screen via svg
    TODO [_renderNodes] place textOnPath
    */
    _renderNodes:function(labelset){
      var svg =  this._map.options.renderer._container;  //to work with SVG
      this._clearNodes(); //clearscreen
      var curID,cur_zero_offset=0; //for handling several parts path - to ensure we have label on each part of feature
      for(var m in labelset){
        if(!curID){
          curID = labelset[m]._item.layer._path.id;
        }else if(curID!==labelset[m]._item.layer._path.id){ //new feature -> start offset from 0
          cur_zero_offset=0;
          curID = labelset[m]._item.layer._path.id;
        }else cur_zero_offset+=labelset[m-1].totalLength;

        var textPath = L.SVG.create('textPath');
        textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", '#'+curID);
        textPath.setAttribute('startOffset',labelset[m].offset_or_origin);
        var text = labelset[m]._item.txNode.textContent;
        labelset[m]._item.txNode.textContent="";
        textPath.appendChild(document.createTextNode(text));
        labelset[m]._item.txNode.appendChild(textPath);
        svg.appendChild(labelset[m]._item.txNode);
        this._nodes.push(labelset[m]._item.txNode);//add this labl to _nodes array, so we can erase it from the screen later
        if(this.options.showBBoxes){
          //here for testing purposes
          var polynode = this._createPolygonNode(labelset[m].poly(),labelset[m].overlaps);
          svg.appendChild(polynode);
          this._nodes.push(polynode); //add this polygon to _nodes array, so we can erase it from the screen later
        }
      }
    }
  }
)

L.autoLabeler = function(map,options){
  return new L.AutoLabeler(map,options);
}

// module.exports = autoLabeler;
