var DOMEssentials = require('./DOMEssentials.js');
var geomEssentials = require('./geomEssentials.js');
var simulatedAnnealing = require('./simulatedAnnealing.js');
var autoLabelManager =require("./autoLabelManager.js");
var dataReader = require('./DataReader.js');
var fgenerator = require('./featureGenerator.js');

L.AutoLabeler = L.Evented.extend(
 {
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
      fgenerator._map = map;
      fgenerator.createLayers();
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
      }else
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

        fgenerator.setMapBounds();
        fgenerator.genPoints(30,10);
        fgenerator._pointsLayer.enableAutoLabel({});

        dataReader._map=this._map;
        var all_items  =dataReader.readDataToLabel(this._map) //array for storing paths and values
        dataReader.prepareCollectedData(all_items,{maxlabelcount:80});
        if(all_items.length==0){
          this._clearNodes();
          return;
        }
        var annMan = new autoLabelManager(all_items);
        var annPerformer = new simulatedAnnealing(annMan,this.options.annealingOptions);
        //annPerformer.perform(this._renderNodes,this);
        annMan.getInitialRandomState();
        annPerformer.evaluateCurSet();
        annMan.markOveralppedLabels(true);
        this._renderNodes(annMan.curset);
      }else{
        this._clearNodes();
      }
    },

    addPolyToLayer:function(poly,overlaps,data_to_show){
      if(!this._polyLayer){
        this._polyLayer = L.featureGroup().addTo(this._map)
      }
      var latlngs=[]; for(var i in poly)latlngs.push(this._map.layerPointToLatLng(
        L.point(poly[i][0],poly[i][1])));
      map_polygon = L.polygon([latlngs],{color:(overlaps)?'red':'yellow',fillOpacity:'0.5'});
      map_polygon.data_to_show =data_to_show;
      this._polyLayer.addLayer(map_polygon);
    },

    /**
    clears label on the screen
    */
    _clearNodes:function() {
      var svg = this._map.options.renderer._container,  //to work with SVG
          i=svg.childNodes.length-1;
      while(i>0){ //because 0 is for g
        var node = svg.childNodes[i--];
        if(node.id.search('auto_label')!==-1)svg.removeChild(node);
      }
      if(this._polyLayer){
        this._map.removeLayer(this._polyLayer);
        delete this._polyLayer;
      }
    },

    /**
    renders computed labelset on the screen via svg
    */
    _renderNodes:function(labelset){
      var svg =  this._map.options.renderer._container;  //to work with SVG
      this._clearNodes(); //clearscreen
      var curID,cur_zero_offset=0; //for handling several parts path - to ensure we have label on each part of feature
      for(var m in labelset){

        var txNode = DOMEssentials.createSVGTextNode("",labelset[m]._item.style);

        switch (labelset[m]._item.layer_type()) {
          case 0:
            txNode.setAttribute('x', labelset[m].offset_or_origin.x);
            txNode.setAttribute('y', labelset[m].offset_or_origin.y);
            txNode.textContent = labelset[m]._item.text;
            break;
          case 1:{

            if(!curID){
              curID = labelset[m]._item.layer._path.id;
            }else if(curID!==labelset[m]._item.layer._path.id){ //new feature -> start offset from 0
              cur_zero_offset=0;
              curID = labelset[m]._item.layer._path.id;
            }else
             cur_zero_offset+=labelset[m-1]._item.totalLength;
            var cOffset =Math.round(cur_zero_offset+labelset[m].offset_or_origin);
            var textPath = L.SVG.create('textPath');
            textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", '#'+curID);
            textPath.setAttribute('startOffset',cOffset);
            textPath.appendChild(document.createTextNode(labelset[m]._item.text));
            txNode.appendChild(textPath);
            break;
          }
        }

        if(this.options.showBBoxes){
           var poly = labelset[m]._item.getItemPoly();
           this.addPolyToLayer(labelset[m].poly(),labelset[m].overlaps,labelset[m]._item.text);
        }

        labelset[m]._item.layer.feature.properties.alabel_offset=m+'__'+cOffset;

        txNode.setAttribute('id','auto_label'+m);
        svg.appendChild(txNode);
      }
      if(this.options.showBBoxes){
        this._polyLayer.eachLayer(function(layer){
            layer.on('click',function(e){
              console.log(layer.data_to_show);
            });
          });
      }
    }
  }
)

L.autoLabeler = function(map,options){
  return new L.AutoLabeler(map,options);
}
