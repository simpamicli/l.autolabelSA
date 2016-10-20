/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "./";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	(function () {
	  "use strict";
	
	  var autoLabeler = __webpack_require__(1);
	
	  var __onRemove = L.LayerGroup.prototype.onRemove;
	  //to include in LabelGroup
	  var AutoLabelingSupport = {
	      /**
	      handle removing layer from the map
	      */
	      onRemove: function (map) {
	      this.disableAutoLabel();
	        __onRemove.call(this, map);
	    },
	
	
	    /**
	     enable autolabeling for this layerGroup, additionally set the current_map variable if it is undefined and hooks label painting on moveend /zoomend events
	     it adds this layerGroup to the _layers2label array, so _doAutoLabel function will know about this layerGroup
	     @param {Object} options: labelStyle - css string to describe labels look, for now one for all layers in group, propertyName - a property from layer.feature.properties which we label on map
	    */
	    enableAutoLabel:function(options){
	      if(!this._map)return;
	      if(!this._map.autoLabeler)return;
	      this._al_options = options || {};
	      this._al_options.labelStyle = options.labelStyle || "fill: lime; stroke: #000000;  font-size: 20px;"; //TODO [enableAutoLabel] add ability to set unique style for each feature
	      this._al_options.propertyName = options.propertyName || "name";
	      this._al_options.priority = options.priority || 0; //highest
	      this._al_options.zoomToStartLabel = options.zoomToStartLabel || this._map.autoLabeler.options.zoomToStartLabel;
	      this._map.autoLabeler.addLayer(this);
	    },
	
	    /**
	    Obtain autlabelling state for this layerGroup
	    @returns {Boolean}
	    */
	    autoLabelEnabled:function(){
	      if(!this._map.autoLabeler)return false;
	      return this._map.autoLabeler.hasLayer(this);
	    },
	
	    /**
	    disable autolabelling
	    */
	    disableAutoLabel:function(){
	      if(!this._map.autoLabeler){
	        delete this._al_options;
	        return;
	      }
	      if(this._map.autoLabeler.remLayer(this)){
	        delete this._al_options;
	      }
	    }
	  }
	
	  L.LayerGroup.include(AutoLabelingSupport);
	
	  L.Map.addInitHook(function () {
	          this.whenReady(function () {
	              if (this.options.autolabel) {
	                this.autoLabeler = L.autoLabeler(this,this.options.autolabelOptions)
	              }
	          });
	      });
	
	})();


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	var DOMEssentials = __webpack_require__(2);
	var geomEssentials = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"./geomEssentials.js\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));
	var simulatedAnnealing = __webpack_require__(9);
	var dataReader = __webpack_require__(12);
	
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
	        simulatedAnnealing.perform(all_items,this.options.annealingOptions,this._renderNodes,this);
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
	        svg.removeChild(this._nodes[i]);
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
	      for(var m in labelset){
	        // var node = labelset[m].t.content_node;
	        // var x = labelset[m].pos.x;
	        // var y = labelset[m].pos.y;
	        // node.setAttribute('x', x);
	        // node.setAttribute('y', y);
	        // var transform ='rotate('+ Math.floor(labelset[m].a)+','+Math.floor(x)+','+Math.floor(y)+')';
	        // transform = transform.replace(/ /g, '\u00A0');
	        // node.setAttribute('transform',transform);
	        // svg.appendChild(node);
	        // this._nodes.push(node);//add this labl to _nodes array, so we can erase it from the screen later
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


/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	//a class to compute pixel dimensions of texts
	/** @namespace DOMEssentials*/
	'use strict';
	var geomEssentials = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"./geomEssentials.js\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));
	
	module.exports = {
	  /**
	  converts TextRectangle object to clockwise array of 2d-arrays, representing rectangular poly
	  @param {TextRectangle} rect: a bbox for text
	  @returns {Array}
	  @memberof DOMEssentials#
	  */
	  convertClientRectToArrayOfArrays:function(rect) {
	    var res=[];
	    var height_correction=rect.height*0.2; //beacuse getBoundingClientRect give a bit false height info
	    res.push([0,0]);
	    res.push([0,-rect.height]);
	    res.push([rect.width,-rect.height]);
	    res.push([rect.width,0]);
	    res=geomEssentials.movePolyByAdding(res,[0,height_correction]);
	    return res;
	  },
	
	  /**
	  returns a bounding box for horizontal text with style as in t.content_node
	  @param {Object} map: current map
	  @param {Object} node: textNode
	  @returns {L.Point} : a bbox for node, as width and height
	  @memberof DOMEssentials#
	  */
	  getBoundingBox:function(map,node){
	    var svg = map.options.renderer._container;
	    svg.appendChild(node);
	    var rect = node.getBoundingClientRect();
	    svg.removeChild(node);
	    return L.point(rect.width,rect.height);
	  },
	
	  /**
	  creates SVG text node with specified style and handles some formatting issues
	  @param {String} text: text for node
	  @param {String} textstyle: CSS style String
	  @returns {TextNode} : SVG node
	  */
	  createSVGTextNode:function(text,textstyle){
	    text = text.replace(/ /g, '\u00A0');  // Non breakable spaces
	    var node =L.SVG.create('text');
	    node.setAttribute('style',textstyle);
	    node.textContent = text;
	    return node;
	  }
	}


/***/ },
/* 3 */,
/* 4 */,
/* 5 */,
/* 6 */,
/* 7 */,
/* 8 */,
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var geomEssentials = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"./geomEssentials.js\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));
	var candidateGenerator = __webpack_require__(10);
	
	var simulatedAnnealing = {
	
	  /**
	  computes the random set of positions for text placement with angles and text values
	  @param {Array} all_items: an array with {t,segs} elements, according to t -text of the polyline, segs - its accepted segments to label on. Result array is generated from items of this array
	  @returns {Array} : an array with elements such as return values of computeLabelCandidate function
	  */
	  getInitialRandomState:function(all_items){
	    var res=[];
	    for(var i=0;i<all_items.length;i++){
	      var candidate = candidateGenerator.computeLabelCandidate(i,all_items);
	      res.push(candidate);
	    }
	    return res;
	  },
	
	  /**
	  may be a custom function, must add result as last value of input array
	  @param {Array} overlapping_values: input array of areas
	  */
	  assignCostFunctionValuesToLastEl:function(overlapping_values){
	    var res=0;
	    for(var i in overlapping_values){
	      res+=overlapping_values[i];
	    }
	    overlapping_values.push(res);
	  },
	
	  /**
	  summarizing ovelapping of all layers. We store for each label it's total overlapping area with others, the sum values for all labels
	  @param {Array}:curset:
	  @returns {Array}: values of areas, last is sum
	  @memberof MapAutoLabelSupport#
	  */
	  evaluateCurSet:function(curset){
	    var overlap_values=[];
	    for(var i in curset){
	      for(var j in curset){
	        if(i>j){ //to exclude variants like compare (1,3) and then (3,1)
	        var curlabel_value=geomEssentials.checkOverLappingArea(curset[i].poly(),curset[j].poly(),this.options.minimizeTotalOverlappingArea);
	        //for each pair(i,j) push it's value into overlap_values array
	        //we know that we iterate through only lower triangle of matrix (i,j), so we can reconstruct i and j from overlap_values index and vice versa
	        //we do it to improve speed when recomputing ovelaps in each annealing iteration in order not to compute all overlaps (with high performance cost)
	        //istead we recompute areas only for changed label
	        overlap_values.push(curlabel_value);
	        }
	      }
	    }
	    this.assignCostFunctionValuesToLastEl(overlap_values);
	    return overlap_values;
	  },
	
	  markOveralppedLabels:function(curset,overlappedvalues){
	    var counter=0;
	    for(var i in curset){
	      for(var j in curset){
	        if(i>j){
	          if(overlappedvalues[counter]>0){
	            curset[i].overlaps = true;
	            curset[j].overlaps = true;
	            // this.dodebug(curset[i].t.content_node.textContent +' /// '+curset[j].t.content_node.textContent  )
	          }
	          counter++;
	        }
	      }
	    }
	  },
	
	  getOverlappingLabelsIndexes:function(curvalues,curset){
	    var counter=0, result=[];
	    for(var i in curset)
	     for(var j in curset)if(i>j){
	       if(curvalues[counter]>0){
	         result.push(i); result.push(j);
	       }
	       counter++;
	     }
	    return result;
	  },
	
	  /**
	  swaps position for a random label with another from this label's positions pool
	  @param {Number} index : index of label in all_items to select new random position from availavle choices.
	  @param {Array} curset: currently selected label postions
	  @param {Array} all_items: all available postions
	  @memberof MapAutoLabelSupport#
	  */
	  swapCandidateInLabelSetToNew:function(idx,curset,all_items){
	    var label_index = curset[idx].all_items_index();
	    var new_candidate = candidateGenerator.computeLabelCandidate(label_index,all_items);
	    curset[idx]=new_candidate;
	  },
	
	  applyNewPositionsForLabelsInArray:function(idx_array,curset,all_items){
	    for(var i in idx_array)this.swapCandidateInLabelSetToNew(idx_array[i],curset,all_items);
	  },
	
	  /**
	  calculates total overlapping area with knowlesge of previous value and what label was moved, affects curvalues
	  @param {Array} curvalue: array of float computed at previous step or initital step, consist of elements of lower-triangluar matrix (i,j) of values of overlapping areas for (i,j) els of curset
	  @param {Array} curset: current set of label with positions
	  @param {Number} changedLabelIndex: an index of label which position we changed
	  */
	  evaluateAfterSeveralChanged:function(curvalues,curset,changedLabels) {
	    var counter=0; //index to iterate through curvalue array
	    while(changedLabels.length>0){
	      var changedLabelIndex=changedLabels.pop();
	      for(var i=0;i<curset.length;i++){
	        for(var j=0;j<curset.length;j++){if(i>j){ //i,j like we used them in the evaluateCurSet function, so we get similar counter values
	          if(i===changedLabelIndex||j===changedLabelIndex){ //here we obtain all indexes of curvales array corresponding to changedLabelIndex
	            var area=this.checkOverLappingArea(curset[i].poly(),curset[j].poly(),this.options.minimizeTotalOverlappingArea); //and recalculate areas
	            curvalues[counter]=area;
	            }
	            counter++;
	          }
	        }
	      }
	    }
	    curvalues.pop(); //remove prev sum
	    this.assignCostFunctionValuesToLastEl(curvalues);
	  },
	
	  dodebug:function(message){
	    if(this.options.debug)console.log(message);
	  },
	
	  processOptions:function(options){
	    this.options=options || {};
	    this.options.t0 = this.options.t0 || 2.5;
	    this.options.decrease_value = this.options.decrease_value || 0.9; //decrease by ten percent each decrease step
	    this.options.tmin = this.options.tmin || 0.0;
	    this.options.constant_temp_repositionings = this.options.constant_temp_repositionings || 10;
	    this.options.max_improvments_count = this.options.max_improvments_count || 10;
	    this.options.max_noimprove_count = this.options.max_noimprove_count || 20;
	    this.options.maxsteps = this.options.maxsteps || 100;
	    this.options.maxtotaliterations = this.options.maxtotaliterations || 100000;
	    this.options.minimizeTotalOverlappingArea=this.options.minimizeTotalOverlappingArea || false;
	    this.options.debug=this.options.debug || true;
	    this.options.allowBothSidesOfLine=this.options.allowBothSidesOfLine || true;
	    candidateGenerator.options.lineDiscreteStepPx = this.options.lineDiscreteStepPx || candidateGenerator.options.lineDiscreteStepPx; //pixels
	  },
	
	  /**
	  find optimal label placement based on simulated annealing approach, relies on paper https://www.eecs.harvard.edu/shieber/Biblio/Papers/jc.label.pdf
	  @param {Array} all_items: an arr with labels and their available line segments to place
	  @param {Object} options: TODO [simulatedAnnealing] add options description
	  @param {Object} callback: a function to gather results and use them to render
	  @param {Object} context: a parent conext of the function  above (arguments.callee - but deprecated)
	  */
	  perform:function(all_items,options,callback,context) {
	        if(all_items.length<1){callback([])} //do nothing if no segments
	        else{
	          var t0 = performance.now();
	          this.processOptions(options);
	          //init
	          var curset=this.getInitialRandomState(all_items), //current label postions
	           curvalues = this.evaluateCurSet(curset), //current overlaping matrix (conflict graph)
	           t=this.options.t0, stepcount=0, doexit=curvalues[curvalues.length-1] === 0,//if no overlaping at init state, do nothing and return curretn state
	           iterations=0, This=this;
	
	          var doReturn = function(){
	              This.dodebug('overlapping labels count = '+curvalues.pop()+', total labels count = '+curset.length+', iterations = '+iterations);
	              This.dodebug('time to annealing = '+(performance.now()-t0));
	              This.markOveralppedLabels(curset,curvalues);
	              callback.call(context,curset);
	            }
	          }
	
	          //step
	          while(true){
	            //while(t>options.tmin && stepcount<options.maxsteps && !doexit
	            if(t<=this.options.tmin || stepcount>=this.options.maxsteps){
	              doReturn();
	              return;
	            }
	            stepcount++;
	            var improvements_count=0, no_improve_count=0;
	            for(var i=0;i<this.options.constant_temp_repositionings*curset.length;i++){ //while constant temperature, do some replacments
	              var oldvalues = curvalues.slice(0), //clone curvalues in order to return to ld ones
	                  oldset = curset.slice(0),
	                  overlapped_indexes = this.getOverlappingLabelsIndexes(curvalues,curset);
	              this.applyNewPositionsForLabelsInArray(overlapped_indexes,curset,all_items);
	              this.evaluateAfterSeveralChanged(curvalues,curset,overlapped_indexes);
	              iterations++;
	              if(curvalues[curvalues.length-1] === 0){ //no overlaps already
	                This.dodebug('strict solution');
	                doReturn();
	                return;
	              }
	              if(iterations>this.options.maxtotaliterations){ //not to hang too long
	                doReturn();
	                return;
	              }
	              var delta = (oldvalues[oldvalues.length-1]-curvalues[curvalues.length-1]);
	              if(delta<0){//ie, new labeling is worse!
	                var P=1 - Math.exp(delta/t);
	                if(P>Math.random()){ //undo label reposition with probability of P
	                  curvalues = oldvalues;
	                  curset=oldset;
	                  no_improve_count++;
	                }else { //approve new repositioning
	                  improvements_count++;
	                  no_improve_count=0;
	                }
	              }else{
	                 improvements_count++;
	                 no_improve_count=0;
	               }
	              if(no_improve_count>=this.options.max_noimprove_count*curset.length){ //it is already optimal
	                This.dodebug('stable state, finish on it');
	                doReturn();
	                return;
	              }
	              if(improvements_count>=this.options.max_improvments_count*curset.length){
	                break; //of for
	              }
	            }
	            //decrease t
	            t*=this.options.decrease_value;
	          };
	      }
	  }
	
	
	module.exports = simulatedAnnealing;


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var geomEssentials = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"./geomEssentials.js\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));
	var itemFactory = __webpack_require__(11);
	
	var candidateGenerator = {
	  options:{
	    lineDiscreteStepPx:3
	  },
	
	  obtainCandidateForPoint(point){
	    //TODO[obtainCandidateForPoint]
	  },
	
	  obtainCandidateForPoly(polygon){
	    //TODO[obtainCandidateForPoly]
	  },
	
	  /**
	  Get a poly (simple with no text along path)for random offset on the polyline
	  @param {Object} item: item from prepareCurSegments's allsegs
	  @returns {Array} : a poly bounding text, placed on corresponding point for offset on poluline and rotated to match segment's skew
	  */
	  obtainCandidateForPolyLineByRandomStartOffset:function(item){
	    var random_offset = item.totalLength*Math.random();
	    var candidate = itemFactory.candidatePosition(random_offset,item);
	    return candidate;
	  },
	
	  /**
	  computes label candidate object to place on map
	  @param {Number} i: an index in all_items array to obtain label candidate for i-item
	  @returns {candidatePosition} : generated candidate
	  */
	  computeLabelCandidate:function(i,all_items) {
	    var candidate;
	    switch (all_items[i].layer_type()) {
	      case 0:
	        break;
	      case 1:{
	          candidate=this.obtainCandidateForPolyLineByRandomStartOffset(all_items[i]);
	          break;
	        }
	      case 2:
	        break;
	    }
	    return candidate;
	  },
	}
	
	module.exports = candidateGenerator;


/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	/*
	modlue to create labelItems convenient for labelling and calculation
	*/
	
	var geomEssentials = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"./geomEssentials.js\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));
	
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
	        return this.host.lastIndexOf(this);
	      },
	      readData:function(){return false}, //a method stub
	      layer_type:function(){
	        //TOFIX for polygon
	        if(!this._layer_type)this._layer_type = (this.layer._parts.length>0)?1:0;
	        return this._layer_type;
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
	      basic_item.computed_lengths=[];
	      basic_item.totalLength=0;
	
	      basic_item.segCount = function(){return this.data.length -1};
	
	      /**
	      Get a segment from polyline part by it's offset
	      @param {Number} offset: na offset for the polyline
	      @returns {Array} : index of start point of segment and dist which is offset from start of the line to the end of found segment
	      */
	      basic_item.getSegmentIdxAndDistByOffset=function(offset){
	        return geomEssentials.getSegmentIdxAndDistByOffset(offset,this.data,this.computed_lengths);
	      }
	
	      /**      
	      get a random element from segments array of the item, assuming it is sorted lengths ascending order
	      probability is higher for longer segment
	      */
	      basic_item.getIndexBasedOnTotalLengthRandom=function(){
	        return geomEssentials.getIndexBasedOnTotalLengthRandom(this.data,this.computed_lengths,this.totalLength);
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
	      @param {Number} start_offset: global offset for this polyline (item), same as used in rendering
	      @param {LabelItem} item:
	      @returns {Array} : a poly bounding curved text
	      */
	      _computePolyForLine:function(start_offset,item){
	        var final_offset = start_offset + item.txSize.x;
	        var end_offset=(final_offset<item.totalLength)?final_offset:item.totalLength;
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


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	/**
	Module to extract sufficient info to label data on the map
	*/
	
	"use strict";
	
	var DOMEssentials = __webpack_require__(2);
	var geomEssentials = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"./geomEssentials.js\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));
	var itemFactory = __webpack_require__(11);
	
	var dataReader = {
	  /**
	  creates an array of features's segments for each feature  of layers2label's layers on screen along with SVG text corresponding to
	  @returns [Array] returns an array with values : {t:{content_node:SVG textnode},parts:feature parts,layertype}, then, in next funcs we add apoly param to t object, ir, its bounding polygon, layertype = 0 marker, 1 polyline, 2 polygon
	  */
	  readDataToLabel:function(){
	    var pt  =[];
	    if(this._map){
	      for(var i in this._map.autoLabeler._layers2label)
	      if(this._map.getZoom()>this._map.autoLabeler._layers2label[i]._al_options.zoomToStartLabel)
	      {
	        var lg=this._map.autoLabeler._layers2label[i],
	            map_to_add = this._map;
	        lg.eachLayer(function(layer){
	          if(layer.feature)
	          if(layer.feature.properties[lg._al_options.propertyName]){
	            var node = DOMEssentials.createSVGTextNode(layer.feature.properties[lg._al_options.propertyName],lg._al_options.labelStyle),
	                size = DOMEssentials.getBoundingBox(map_to_add,node); //compute ortho aligned bbox for this text, only once, common for all cases
	            var firstItem = itemFactory.labelItem(node,size,layer,pt)
	            if(firstItem){
	              var nextPartIndex=firstItem.readData();
	              pt.push(firstItem);
	              while(nextPartIndex){
	                var item = itemFactory.labelItem(node,size,layer,pt); //create node template
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
	    for(var i=0;i<all_items.length;i++){
	      var item = all_items[i];
	      if(item.layer_type()==0){//if point -> do nothing.
	        continue;
	      }
	      //else compute for lines and polygons, now it is only fo lines
	      if(item.layer_type()==1){
	        this._applyLineFeatureData(item); //in case where two or move separate polylines generated for original polyline while rendering (imagine big W cutted by screen iwndow)
	      }
	    }
	    return true;
	  },
	
	  /**
	  Calculates total length for this polyline on screen, and lengths of each segments with their angles
	  @param {labelItem} item: an item to get above data to
	  */
	  _applyLineFeatureData:function(item){ //calculate some data once to increase performance
	      item.totalLength=0;
	      item.computed_lengths = geomEssentials.computeSegmentsLengths(item.data);
	      for(var k=0;k<item.computed_lengths.length;k++){
	        item.totalLength+=item.computed_lengths[k];
	      }
	  }
	}
	
	module.exports = dataReader;


/***/ }
/******/ ]);
//# sourceMappingURL=l.autolabelSA.js.map