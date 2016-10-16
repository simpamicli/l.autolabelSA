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
	var geomEssentials = __webpack_require__(3);
	var simulatedAnnealing = __webpack_require__(9);
	var dataReader = __webpack_require__(11);
	
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
	        var pt  =dataReader.readDataToLabel(this._map) //array for storing paths and values
	        var all_items=dataReader.prepareCurSegments(pt,{maxlabelcount:80});
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
	        points+=poly[i][0]+','+poly[i][1]+' ';
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
	          var polynode = this._createPolygonNode(labelset[m].poly,labelset[m].overlaps);
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
	var geomEssentials = __webpack_require__(3);
	
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
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	//a class to perfrom geometric stuff
	/** @namespace geomEssentials*/
	'use strict';
	
	var greinerHormann = __webpack_require__(4);
	
	var geomEssentials = {
	
	  /**
	  makes x and y integer
	  */
	  roundPoint:function(p){
	    var res= L.point(Math.round(p.x),Math.round(p.y));
	    return res;
	  },
	
	  /**
	  scales bounds by multiplying it's size with scalefactor, and keeping center
	  */
	  scaleBounds:function(bounds,scalefactor){
	    var origin = bounds.getCenter();
	    var newHalfSize = bounds.getSize().multiplyBy(scalefactor/2);
	    var newTopLeft = origin.subtract(newHalfSize);
	    var newBotRight = origin.add(newHalfSize);
	    return L.bounds(this.roundPoint(newTopLeft),this.roundPoint(newBotRight));
	  },
	
	  /**
	  the name is the description
	  */
	  getBoundsWithoutPadding(themap,scaleafter){
	    var bounds =themap.options.renderer._bounds;
	    //to get zero padding we should scale bounds by 1 / (1 + current_padding), and then we want to scale by scaleafter
	    //for example, default padding is 0.1, which means 110% of map container pixel bounds to render, so zise of basic ixels bounds is multiplied by 1.1getPixelBounds()
	    var current_padding = themap.options.renderer.padding || 0.1;
	    var scale_to_apply = scaleafter/(1+current_padding);
	    return this.scaleBounds(bounds,scaleafter);
	    //return bounds;
	  },
	
	  /**
	  moves a poly by adding pt2add point to all its vertices
	  @param {Array} poly: a poly to movePoly
	  @param {Array} pt2add: a point to add to all vertices
	  @returns {Array}: moved poly
	  @memberof geomEssentials#
	  */
	  movePolyByAdding:function(poly,pt2add) {
	    var res=poly.slice(0);
	    for(var i=0;i<poly.length;i++){
	      res[i][0]+=pt2add[0]; res[i][1]+=pt2add[1];
	    }
	    return res;
	  },
	
	  /**
	  moves a poly by translating all its vertices to moveto, using first vertex as origin
	  @param {Array} poly: a poly to movePoly
	  @param {Array} moveto: where translate all vertices
	  @returns {Array}: moved poly
	  @memberof geomEssentials#
	  */
	  movePolyByMovingTo:function(poly,moveto){
	    var res=poly.slice(0);
	    moveto[0] = moveto[0]-poly[0][0];
	    moveto[1] = moveto[1]-poly[0][1];
	    for(var i=1;i<poly.length;i++){
	      res[i][0]+=moveto[0]; res[i][1]+=moveto[1];
	    }
	    return res;
	  },
	
	  /**
	  returns {seglen, angle} data structure for a,b segment
	  @param {L.Point} a: start point
	  @param {L.Point} b: fin point
	  @returns {Object}:
	  */
	  computeSegDataLenAngle:function(a,b){
	    ablen = a.distanceTo(b), //compute segment length only once
	    abangle = this.computeAngle(a,b,true); //same for angles
	    return {seglen:ablen,angle:abangle};
	  },
	
	  /**
	  translates segment to new loc by adding point to its vertices
	  @param {Array} segment:
	  @param {L.Point} point:
	  @returns {Array}:
	  */
	  translateSegment:function(segment, point){
	    var result=segment.sliuce(0);
	    result[0] = result[0].add(point);
	    result[1] = result[2].add(point);
	    return result;
	  },
	  /**
	  code from L.GeometryUtil plugin
	  @memberof geomEssentials#
	  */
	  computeAngle: function(a, b, check_left_to_right) {
	      var x1 = a.x, x2 = b.x;
	      if(check_left_to_right){
	        if(x1>x2){
	          var tmp=x1; x1=x2; x2=tmp;
	        }
	      }
	      return (Math.atan2(b.y - a.y, x2 - x1) * 180 / Math.PI);
	  },
	
	  /**
	  code from L.GeometryUtil plugin
	       Returns slope (Ax+B) between two points.
	        @param {L.Point} a
	        @param {L.Point} b
	        @returns {Object} with ``a`` and ``b`` properties.
	     */
	  computeSlope: function(a, b) {
	      var s = (b.y - a.y) / (b.x - a.x),
	          o = a.y - (s * a.x);
	      return {a: s, b: o};
	  },
	
	  getNormalOnSegment:function(segment){
	    var slope = this.computeSlope(segment[0],segment[1]);
	    return this.normalizePt(slope);
	  },
	
	  get2dVectorLength:function(pt){
	    return Math.sqrt(pt.x*pt.x + pt.y*pt.y);
	  },
	
	  normalizePt:function(pt){
	    return (pt.x===0&&pt.y===0)?0:pt.divideBy(this.get2dVectorLength(pt));
	  },
	
	  /**
	  copies segment and translates copy in normal direction by height value (may be negative)
	  @param {Array} segment: a segment to translates
	  @param {Number} height: how factory
	  @returns {Array}: translated copy of segment
	  */
	  translateByNormal:function(segment,height){
	    var normal = this.getNormalOnSegment(segment).multiplyBy(height);
	    return segment.translateSegment(normal);
	  },
	
	  /**
	  code from L.GeometryUtil plugin
	  @memberof geomEssentials#
	  */
	  interpolateOnPointSegment: function (segment, ratio) {
	      return L.point(
	          (segment[0].x * (1 - ratio)) + (ratio * segment[1].x),
	          (segment[0].y * (1 - ratio)) + (ratio * segment[1].y)
	      );
	  },
	
	  /**
	  extracts sub-polyline frim give item's data line
	  @param {Number} offset_start:
	  @param {Number} offset_end:
	  @param {labelItem} item: item layer_type 1 with data and segdata fill
	  @returns {Array}: array of L.Point
	  */
	  extractSubPolyline:function(offset_start,offset_end,item, extract_as_segments){
	    var start = item.getSegmentIdxAndDistByOffset(offset_start),
	        end = item.getSegmentIdxAndDistByOffset(offset_end),
	        firstSeg = item.getSegment(start.index);
	        firstSeg[0] = this.interpolateOnPointSegment(firstSeg,(start.dist-offset_start)/firstSeg[2].seglen);
	    firstSeg[2].seglen =firstSeg[2].seglen - (start.dist-offset_start);
	
	    var result = extract_as_segments ? firstSeg : firstSeg.slice(0,1);
	
	    if(start.index == end.index)return result; //one segment case
	    var lastSeg = item.getSegment(end.index);
	    lastseg[1] = this.interpolateOnPointSegment(lastSeg,(end.dist-offset_end)/lastSeg[2].seglen);
	    lastseg[2].seglen = start.dist-offset_start;
	
	
	    //and if we have segments in between first/last:
	    for(var i=start.index+1;i<end.index;i++){
	      var segment = item.getSegment(i);
	      result.push(extract_as_segments? segment:segment[1]);
	    }
	    result.push(extract_as_segments? lastSeg:lastSeg[1]);
	    return result;
	  },
	
	  /**
	  computes a point where two lines intersection
	  @param {Array} seg1: a first line defined by two points
	  @param {Array} seg2: a second line defined by two points
	  @return {L.Point} :intersection point or null if lines are parallel to each other
	  */
	  lineIntersection:function(seg1,seg2){
	    var slope1=this.computeSlope(seg1[0],seg1[1]);
	    var slope2=this.computeSlope(seg2[0],seg2[1]);
	    if(slope1.x===slope2.x)return;
	    var x = (slope2.y - slope1.y) / (slope11.x - slope2.x);
	    var y = slope1.x*x + slope1.y;
	    return L.point(x,y);
	  },
	
	  /**
	  expangs a segment withing length in direction from seg[0] to seg[1]
	  @param {Array} segment: a segment defined by two points
	  @param {Number} length:how much increase segment len, should be positive
	  @return {Array} : expanded segment
	  */
	  expandSegment:function(segment,length){
	    var res=segment.slice(0);
	    if(length>0){
	      res[1]=this.interpolateOnPointSegment(segment,(length + segment[2].seglen)/segment[2].seglen);
	    }
	    return res;
	  },
	
	  clipPoly:function(poly1,poly2){
	    var intersection = greinerHormann.intersection(poly1, poly2);
	    if(!intersection)return [];
	    if(intersection.length>0)return intersection[0];
	  },
	
	  /**
	  returns a combined poly from two
	  */
	  addPoly:function(poly1,poly2){
	    var union = greinerHormann.union(poly1, poly2);
	    if(!union)return [];
	    if(union.length>0)return union[0];
	  },
	
	  subtractPoly:function(poly1,poly2){
	    var diff = greinerHormann.diff(poly1, poly2);
	    if(!diff)return [];else return diff;
	  },
	
	  /**
	  code from http://www.codeproject.com/Articles/13467/A-JavaScript-Implementation-of-the-Surveyor-s-Form
	  for single polygon only, and no holes in
	  @param {Array} poly: a poly to determine area of
	  @memberof geomEssentials#
	  */
	  polyArea:function(poly) {
	    // Calculate the area of a polygon
	    // using the data stored
	    // in the arrays x and y
	    var area = 0.0;
	    if(poly){
	      var poly=poly.slice(0);
	      if(poly.length>2)poly.push(poly[0]); //close the poly
	      for(var k = 0; k < poly.length-1; k++ ) {
	          var xDiff = poly[k+1][0] - poly[k][0];
	          var yDiff = poly[k+1][1] - poly[k][1];
	          area += + poly[k][0] * yDiff - poly[k][1] * xDiff;
	      }
	      area = 0.5 * area;
	    }
	    return area;
	  },
	
	  /**
	  rotates given polygon to a given angle around basepoint
	  code partialy from web, don't remember from...
	  @param {Array} poly: a polygon to rotate
	  @param {Array} basepoint: base point
	  @param {float} angle: an angle in degrees
	  @returns {Array}: rotated poly
	  @memberof geomEssentials#
	  */
	  rotatePoly:function(poly, basepoint,angle){
	    var res=[];
	    var angleRad = angle*Math.PI/180;
	    for(var i=0;i<poly.length;i++){
	      var pPoint = poly[i],
	      x_rotated = Math.cos(angleRad)*(pPoint[0]-basepoint[0]) - Math.sin(angleRad)*(pPoint[1]-basepoint[1]) + basepoint[0],
	      y_rotated = Math.sin(angleRad)*(pPoint[0]-basepoint[0]) + Math.cos(angleRad)*(pPoint[1]-basepoint[1]) + basepoint[1];
	      res.push([x_rotated,y_rotated]);
	    }
	    return res;
	  },
	
	  createPoly:function(width,height){
	    //TODO[createPoly]
	  }
	
	}
	
	module.exports = geomEssentials;


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var clip = __webpack_require__(5);
	
	module.exports = {
	    /**
	     * @api
	     * @param  {Array.<Array.<Number>|Array.<Object>} polygonA
	     * @param  {Array.<Array.<Number>|Array.<Object>} polygonB
	     * @return {Array.<Array.<Number>>|Array.<Array.<Object>|Null}
	     */
	    union: function(polygonA, polygonB) {
	        return clip(polygonA, polygonB, false, false);
	    },
	
	    /**
	     * @api
	     * @param  {Array.<Array.<Number>|Array.<Object>} polygonA
	     * @param  {Array.<Array.<Number>|Array.<Object>} polygonB
	     * @return {Array.<Array.<Number>>|Array.<Array.<Object>>|Null}
	     */
	    intersection: function(polygonA, polygonB) {
	        return clip(polygonA, polygonB, true, true);
	    },
	
	    /**
	     * @api
	     * @param  {Array.<Array.<Number>|Array.<Object>} polygonA
	     * @param  {Array.<Array.<Number>|Array.<Object>} polygonB
	     * @return {Array.<Array.<Number>>|Array.<Array.<Object>>|Null}
	     */
	    diff: function(polygonA, polygonB) {
	        return clip(polygonA, polygonB, false, true);
	    },
	
	    clip: clip
	};


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var Polygon = __webpack_require__(6);
	
	/**
	 * Clip driver
	 * @api
	 * @param  {Array.<Array.<Number>>} polygonA
	 * @param  {Array.<Array.<Number>>} polygonB
	 * @param  {Boolean}                sourceForwards
	 * @param  {Boolean}                clipForwards
	 * @return {Array.<Array.<Number>>}
	 */
	module.exports = function(polygonA, polygonB, eA, eB) {
	    var result, source = new Polygon(polygonA),
	        clip = new Polygon(polygonB),
	        result = source.clip(clip, eA, eB);
	
	    return result;
	};


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	var Vertex = __webpack_require__(7);
	var Intersection = __webpack_require__(8);
	
	/**
	 * Polygon representation
	 * @param {Array.<Array.<Number>>} p
	 * @param {Boolean=}               arrayVertices
	 *
	 * @constructor
	 */
	var Polygon = function(p, arrayVertices) {
	
	    /**
	     * @type {Vertex}
	     */
	    this.first = null;
	
	    /**
	     * @type {Number}
	     */
	    this.vertices = 0;
	
	    /**
	     * @type {Vertex}
	     */
	    this._lastUnprocessed = null;
	
	    /**
	     * Whether to handle input and output as [x,y] or {x:x,y:y}
	     * @type {Boolean}
	     */
	    this._arrayVertices = (typeof arrayVertices === "undefined") ?
	        Array.isArray(p[0]) :
	        arrayVertices;
	
	    for (var i = 0, len = p.length; i < len; i++) {
	        this.addVertex(new Vertex(p[i]));
	    }
	};
	
	/**
	 * Add a vertex object to the polygon
	 * (vertex is added at the 'end' of the list')
	 *
	 * @param vertex
	 */
	Polygon.prototype.addVertex = function(vertex) {
	    if (this.first == null) {
	        this.first = vertex;
	        this.first.next = vertex;
	        this.first.prev = vertex;
	    } else {
	        var next = this.first,
	            prev = next.prev;
	
	        next.prev = vertex;
	        vertex.next = next;
	        vertex.prev = prev;
	        prev.next = vertex;
	    }
	    this.vertices++;
	};
	
	/**
	 * Inserts a vertex inbetween start and end
	 *
	 * @param {Vertex} vertex
	 * @param {Vertex} start
	 * @param {Vertex} end
	 */
	Polygon.prototype.insertVertex = function(vertex, start, end) {
	    var prev, curr = start;
	
	    while (!curr.equals(end) && curr._distance < vertex._distance) {
	        curr = curr.next;
	    }
	
	    vertex.next = curr;
	    prev = curr.prev;
	
	    vertex.prev = prev;
	    prev.next = vertex;
	    curr.prev = vertex;
	
	    this.vertices++;
	};
	
	/**
	 * Get next non-intersection point
	 * @param  {Vertex} v
	 * @return {Vertex}
	 */
	Polygon.prototype.getNext = function(v) {
	    var c = v;
	    while (c._isIntersection) {
	        c = c.next;
	    }
	    return c;
	};
	
	/**
	 * Unvisited intersection
	 * @return {Vertex}
	 */
	Polygon.prototype.getFirstIntersect = function() {
	    var v = this._firstIntersect || this.first;
	
	    do {
	        if (v._isIntersection && !v._visited) {
	            break;
	        }
	
	        v = v.next;
	    } while (!v.equals(this.first));
	
	    this._firstIntersect = v;
	    return v;
	};
	
	/**
	 * Does the polygon have unvisited vertices
	 * @return {Boolean} [description]
	 */
	Polygon.prototype.hasUnprocessed = function() {
	    var v = this._lastUnprocessed || this.first;
	    do {
	        if (v._isIntersection && !v._visited) {
	            this._lastUnprocessed = v;
	            return true;
	        }
	
	        v = v.next;
	    } while (!v.equals(this.first));
	
	    this._lastUnprocessed = null;
	    return false;
	};
	
	/**
	 * The output depends on what you put in, arrays or objects
	 * @return {Array.<Array<Number>|Array.<Object>}
	 */
	Polygon.prototype.getPoints = function() {
	    var points = [],
	        v = this.first;
	
	    if (this._arrayVertices) {
	        do {
	            points.push([v.x, v.y]);
	            v = v.next;
	        } while (v !== this.first);
	    } else {
	        do {
	            points.push({
	                x: v.x,
	                y: v.y
	            });
	            v = v.next;
	        } while (v !== this.first);
	    }
	
	    return points;
	};
	
	/**
	 * Clip polygon against another one.
	 * Result depends on algorithm direction:
	 *
	 * Intersection: forwards forwards
	 * Union:        backwars backwards
	 * Diff:         backwards forwards
	 *
	 * @param {Polygon} clip
	 * @param {Boolean} sourceForwards
	 * @param {Boolean} clipForwards
	 */
	Polygon.prototype.clip = function(clip, sourceForwards, clipForwards) {
	    var sourceVertex = this.first,
	        clipVertex = clip.first,
	        sourceInClip, clipInSource;
	
	    // calculate and mark intersections
	    do {
	        if (!sourceVertex._isIntersection) {
	            do {
	                if (!clipVertex._isIntersection) {
	                    var i = new Intersection(
	                        sourceVertex,
	                        this.getNext(sourceVertex.next),
	                        clipVertex, clip.getNext(clipVertex.next));
	
	                    if (i.valid()) {
	                        var sourceIntersection =
	                            Vertex.createIntersection(i.x, i.y, i.toSource),
	                            clipIntersection =
	                            Vertex.createIntersection(i.x, i.y, i.toClip);
	
	                        sourceIntersection._corresponding = clipIntersection;
	                        clipIntersection._corresponding = sourceIntersection;
	
	                        this.insertVertex(
	                            sourceIntersection,
	                            sourceVertex,
	                            this.getNext(sourceVertex.next));
	                        clip.insertVertex(
	                            clipIntersection,
	                            clipVertex,
	                            clip.getNext(clipVertex.next));
	                    }
	                }
	                clipVertex = clipVertex.next;
	            } while (!clipVertex.equals(clip.first));
	        }
	
	        sourceVertex = sourceVertex.next;
	    } while (!sourceVertex.equals(this.first));
	
	    // phase two - identify entry/exit points
	    sourceVertex = this.first;
	    clipVertex = clip.first;
	
	    sourceInClip = sourceVertex.isInside(clip);
	    clipInSource = clipVertex.isInside(this);
	
	    sourceForwards ^= sourceInClip;
	    clipForwards ^= clipInSource;
	
	    do {
	        if (sourceVertex._isIntersection) {
	            sourceVertex._isEntry = sourceForwards;
	            sourceForwards = !sourceForwards;
	        }
	        sourceVertex = sourceVertex.next;
	    } while (!sourceVertex.equals(this.first));
	
	    do {
	        if (clipVertex._isIntersection) {
	            clipVertex._isEntry = clipForwards;
	            clipForwards = !clipForwards;
	        }
	        clipVertex = clipVertex.next;
	    } while (!clipVertex.equals(clip.first));
	
	    // phase three - construct a list of clipped polygons
	    var list = [];
	
	    while (this.hasUnprocessed()) {
	        var current = this.getFirstIntersect(),
	            // keep format
	            clipped = new Polygon([], this._arrayVertices);
	
	        clipped.addVertex(new Vertex(current.x, current.y));
	        do {
	            current.visit();
	            if (current._isEntry) {
	                do {
	                    current = current.next;
	                    clipped.addVertex(new Vertex(current.x, current.y));
	                } while (!current._isIntersection);
	
	            } else {
	                do {
	                    current = current.prev;
	                    clipped.addVertex(new Vertex(current.x, current.y));
	                } while (!current._isIntersection);
	            }
	            current = current._corresponding;
	        } while (!current._visited);
	
	        list.push(clipped.getPoints());
	    }
	
	    if (list.length === 0) {
	        if (sourceInClip) {
	            list.push(this.getPoints());
	        }
	        if (clipInSource) {
	            list.push(clip.getPoints());
	        }
	        if (list.length === 0) {
	            list = null;
	        }
	    }
	
	    return list;
	};
	
	module.exports = Polygon;


/***/ },
/* 7 */
/***/ function(module, exports) {

	/**
	 * Vertex representation
	 *
	 * @param {Number|Array.<Number>} x
	 * @param {Number=}               y
	 *
	 * @constructor
	 */
	var Vertex = function(x, y) {
	
	    if (arguments.length === 1) {
	        // Coords
	        if (Array.isArray(x)) {
	            y = x[1];
	            x = x[0];
	        } else {
	            y = x.y;
	            x = x.x;
	        }
	    }
	
	    /**
	     * X coordinate
	     * @type {Number}
	     */
	    this.x = x;
	
	    /**
	     * Y coordinate
	     * @type {Number}
	     */
	    this.y = y;
	
	    /**
	     * Next node
	     * @type {Vertex}
	     */
	    this.next = null;
	
	    /**
	     * Previous vertex
	     * @type {Vertex}
	     */
	    this.prev = null;
	
	    /**
	     * Corresponding intersection in other polygon
	     */
	    this._corresponding = null;
	
	    /**
	     * Distance from previous
	     */
	    this._distance = 0.0;
	
	    /**
	     * Entry/exit point in another polygon
	     * @type {Boolean}
	     */
	    this._isEntry = true;
	
	    /**
	     * Intersection vertex flag
	     * @type {Boolean}
	     */
	    this._isIntersection = false;
	
	    /**
	     * Loop check
	     * @type {Boolean}
	     */
	    this._visited = false;
	};
	
	/**
	 * Creates intersection vertex
	 * @param  {Number} x
	 * @param  {Number} y
	 * @param  {Number} distance
	 * @return {Vertex}
	 */
	Vertex.createIntersection = function(x, y, distance) {
	    var vertex = new Vertex(x, y);
	    vertex._distance = distance;
	    vertex._isIntersection = true;
	    vertex._isEntry = false;
	    return vertex;
	};
	
	/**
	 * Mark as visited
	 */
	Vertex.prototype.visit = function() {
	    this._visited = true;
	    if (this._corresponding !== null && !this._corresponding._visited) {
	        this._corresponding.visit();
	    }
	};
	
	/**
	 * Convenience
	 * @param  {Vertex}  v
	 * @return {Boolean}
	 */
	Vertex.prototype.equals = function(v) {
	    return this.x === v.x && this.y === v.y;
	};
	
	/**
	 * Check if vertex is inside a polygon by odd-even rule:
	 * If the number of intersections of a ray out of the point and polygon
	 * segments is odd - the point is inside.
	 * @param {Polygon} poly
	 * @return {Boolean}
	 */
	Vertex.prototype.isInside = function(poly) {
	    var oddNodes = false,
	        vertex = poly.first,
	        next = vertex.next,
	        x = this.x,
	        y = this.y;
	
	    do {
	        if ((vertex.y < y && next.y >= y ||
	                next.y < y && vertex.y >= y) &&
	            (vertex.x <= x || next.x <= x)) {
	
	            oddNodes ^= (vertex.x + (y - vertex.y) /
	                (next.y - vertex.y) * (next.x - vertex.x) < x);
	        }
	
	        vertex = vertex.next;
	        next = vertex.next || poly.first;
	    } while (!vertex.equals(poly.first));
	
	    return oddNodes;
	};
	
	module.exports = Vertex;


/***/ },
/* 8 */
/***/ function(module, exports) {

	/**
	 * Intersection
	 * @param {Vertex} s1
	 * @param {Vertex} s2
	 * @param {Vertex} c1
	 * @param {Vertex} c2
	 * @constructor
	 */
	var Intersection = function(s1, s2, c1, c2) {
	
	    /**
	     * @type {Number}
	     */
	    this.x = 0.0;
	
	    /**
	     * @type {Number}
	     */
	    this.y = 0.0;
	
	    /**
	     * @type {Number}
	     */
	    this.toSource = 0.0;
	
	    /**
	     * @type {Number}
	     */
	    this.toClip = 0.0;
	
	    var d = (c2.y - c1.y) * (s2.x - s1.x) - (c2.x - c1.x) * (s2.y - s1.y);
	
	    if (d === 0) {
	        return;
	    }
	
	    /**
	     * @type {Number}
	     */
	    this.toSource = ((c2.x - c1.x) * (s1.y - c1.y) - (c2.y - c1.y) * (s1.x - c1.x)) / d;
	
	    /**
	     * @type {Number}
	     */
	    this.toClip = ((s2.x - s1.x) * (s1.y - c1.y) - (s2.y - s1.y) * (s1.x - c1.x)) / d;
	
	    if (this.valid()) {
	        this.x = s1.x + this.toSource * (s2.x - s1.x);
	        this.y = s1.y + this.toSource * (s2.y - s1.y);
	    }
	};
	
	/**
	 * @return {Boolean}
	 */
	Intersection.prototype.valid = function() {
	    return (0 < this.toSource && this.toSource < 1) && (0 < this.toClip && this.toClip < 1);
	};
	
	module.exports = Intersection;


/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var geomEssentials = __webpack_require__(3);
	var candidateGenerator = __webpack_require__(10);
	
	var simulatedAnnealing = {
	
	  /**
	  computes the random set of positions for text placement with angles and text values
	  @param {Array} allsegs: an array with {t,segs} elements, according to t -text of the polyline, segs - its accepted segments to label on. Result array is generated from items of this array
	  @returns {Array} : an array with elements such as return values of computeLabelCandidate function
	  */
	  getInitialRandomState:function(allsegs){
	    var res=[];
	    for(var i in allsegs){
	      var candidate = candidateGenerator.computeLabelCandidate(i,allsegs);
	      res.push(candidate);
	    }
	    return res;
	  },
	
	  /**
	  check if two labels overlab, if no returns false, if yes returns ???area OR polygon??? of averlap
	  @param {} poly1:a first polygon to check overlap with second
	  @param {} poly2:a second polygon to check overlap with first
	  @returns {float}: an area of overlapping, zero if no overlapping
	  */
	  checkOverLappingArea:function(poly1,poly2,calculateAreaNotOnlyFactOfOverlapping) {
	    var clipped = geomEssentials.clipPoly(poly1,poly2);
	    if(calculateAreaNotOnlyFactOfOverlapping){
	      var area =geomEssentials.polyArea(clipped);
	      return area;
	    };
	    if(clipped.length>0)return 1;else return 0; //for performance, skip area calculation
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
	        var curlabel_value=this.checkOverLappingArea(curset[i].poly,curset[j].poly,this.options.minimizeTotalOverlappingArea);
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
	            this.dodebug(curset[i].t.content_node.textContent +' /// '+curset[j].t.content_node.textContent  )
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
	  @param {Number} index : index of label in allsegs to select new random position from availavle choices.
	  @param {Array} curset: currently selected label postions
	  @param {Array} allsegs: all available postions
	  @memberof MapAutoLabelSupport#
	  */
	  swapCandidateInLabelSetToNew:function(idx,curset,allsegs){
	    var label_index = curset[idx].allsegs_index;
	    var new_candidate = candidateGenerator.computeLabelCandidate(label_index,allsegs);
	    curset[idx]=new_candidate;
	  },
	
	  applyNewPositionsForLabelsInArray:function(idx_array,curset,allsegs){
	    for(var i in idx_array)this.swapCandidateInLabelSetToNew(idx_array[i],curset,allsegs);
	  },
	
	  /**
	  calculates total overlapping area with knowlesge of previous value and what label was moved
	  @param {Array} curvalue: array of float computed at previous step or initital step, consist of elements of lower-triangluar matrix (i,j) of values of overlapping areas for (i,j) els of curset
	  @param {Array} curset: current set of label with positions
	  @param {Number} changedLabelIndex: an index of label which position we changed
	  @returns {Array} : curvalues, recalculated
	  @memberof MapAutoLabelSupport#
	  */
	  evaluateAfterSeveralChanged:function(curvalues,curset,changedLabels) {
	    var counter=0; //index to iterate through curvalue array
	    while(changedLabels.length>0){
	      var changedLabelIndex=changedLabels.pop();
	      for(var i=0;i<curset.length;i++){
	        for(var j=0;j<curset.length;j++){if(i>j){ //i,j like we used them in the evaluateCurSet function, so we get similar counter values
	          if(i===changedLabelIndex||j===changedLabelIndex){ //here we obtain all indexes of curvales array corresponding to changedLabelIndex
	            var area=this.checkOverLappingArea(curset[i].poly,curset[j].poly,this.options.minimizeTotalOverlappingArea); //and recalculate areas
	            curvalues[counter]=area;
	            }
	            counter++;
	          }
	        }
	      }
	    }
	    curvalues.pop(); //remove prev sum
	    this.assignCostFunctionValuesToLastEl(curvalues);
	    return curvalues;
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
	  @param {Array} allsegs: an arr with labels and their available line segments to place
	  @param {Object} options: TODO [simulatedAnnealing] add options description
	  @param {Object} callback: a function to gather results and use them to render
	  @param {Object} context: a parent conext of the function  above (arguments.callee - but deprecated)
	  */
	  perform:function(allsegs,options,callback,context) {
	        if(allsegs.length<1){callback([])} //do nothing if no segments
	        else{
	          var t0 = performance.now();
	          this.processOptions(options);
	          //init
	          var curset=this.getInitialRandomState(allsegs), //current label postions
	           curvalues = this.evaluateCurSet(curset), //current overlaping matrix (conflict graph)
	           t=this.options.t0, stepcount=0, doexit=curvalues[curvalues.length-1] === 0,//if no overlaping at init state, do nothing and return curretn state
	           iterations=0, This=this;
	
	          var doReturn = function(dorender){
	            This.dodebug('-----');
	            if(dorender){
	              This.dodebug('overlapping labels count = '+curvalues.pop()+', total labels count = '+curset.length+', iterations = '+iterations);
	              This.dodebug('time to annealing = '+(performance.now()-t0));
	              This.markOveralppedLabels(curset,curvalues);
	              callback.call(context,curset);
	            }else{
	              This.dodebug('Map state has been changed. Terminated.');
	            }
	          }
	
	          //step
	          while(true){
	            var dorender=true;
	             //let know map which timer we are using
	            //while constant temperature, do some replacments:
	            //  while(t>options.tmin && stepcount<options.maxsteps && !doexit
	            if(t<=this.options.tmin || stepcount>=this.options.maxsteps){
	              doReturn(dorender);
	              return;
	            }
	            stepcount++;
	            var improvements_count=0, no_improve_count=0;
	            for(var i=0;i<this.options.constant_temp_repositionings*curset.length;i++){
	              var oldvalues = curvalues.slice(0); //clone curvalues in order to return to ld ones
	              var oldset = curset.slice(0);
	              //now replace randomly all positions, not a sim ann actually
	              //TODO [simulatedAnnealing] do actual sim ann - move only overlapping now labels to new random position, for example
	              var overlapped_indexes = this.getOverlappingLabelsIndexes(curvalues,curset);
	              this.applyNewPositionsForLabelsInArray(overlapped_indexes,curset,allsegs);
	              // this.evaluateAfterSeveralChanged(curvalues,curset,overlapped_indexes);
	              curvalues=this.evaluateCurSet(curset);
	              iterations++;
	              if(curvalues[curvalues.length-1] === 0){ //no overlaps already
	                This.dodebug('strict solution');
	                doReturn(dorender);
	                return;
	              }
	              if(iterations>this.options.maxtotaliterations){ //not to hang too long
	                doReturn(dorender);
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
	                doReturn(dorender);
	                return;
	              }
	              if(improvements_count>=this.options.max_improvments_count*curset.length){
	                //immediately exit cycle and decrease current t
	                doReturn(dorender);
	                return;
	              }
	            }
	            //decrease t
	            t*=this.options.decrease_value;
	          };
	      }
	  }
	}
	
	module.exports = simulatedAnnealing;


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var geomEssentials = __webpack_require__(3);
	var itemFactory = __webpack_require__(12);
	
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
	  Used for calculationg overlaps for text along path (textPath SVG).
	  @param {Number} start_offset: global offset for this polyline (item), same as used in rendering
	  @param {Object} item: item from prepareCurSegments's allsegs
	  @returns {Array} : a poly bounding curved text
	  TODO [computeComplexPolyForLine] rewrite for new notation
	  */
	  computeComplexPolyForLine:function(start_offset,item){
	    var final_offset = start_offset + item.txSize.w;
	    var end_offset=(final_offset<=item.totalLength)?final_offset:item.totalLength;
	    var sub_polyline = geomEssentials.extractSubPolyline(start_offset,end_offset,item,true); // as segments array
	
	    for(var i in sub_polyline){
	      segment = sub_polyline[i];
	    }
	
	    //TODO when label is longer than available polyline - no need to, beacuse text is trimmed, maybe show a warning?
	
	
	  },
	
	  computeComplexPolyForLineoldfunction(start_offset,item){
	    var idxNdistStart = this._getSegmentIdxAndDistByOffset(start_offset,item);
	    var labelLength = item.t.poly[2][0], labelHeight = Math.abs(item.t.poly[1][1]),
	        segStart = item.segs[idxNdistStart.index],
	        labelSpaceOnFirstSegment = (idxNdistStart.dist - start_offset);
	
	    //TODO [computeComplexPolyForLine] check left-to-right text orientation on final polygone!
	
	
	    //in the next lines we construct upper boundary of total polygone - lower is polyline actually =)
	    //now fill above lines
	    var above_line = [getAboveLine(segStart,segStart.seglen -  labelSpaceOnFirstSegment,labelLength,labelHeight)];
	    var above_lines = [above_line.line];
	    var finishOnLineBelow = above_line.line[1];
	    var remaining_length = labelLength-above_line.minusLen;
	    //if we have more than 1 segment to cover:
	    if(labelSpaceOnFirstSegment < labelLength && idxNdistStart.index<(item.segs.length-1)){
	      var idxNdisEnd = this._getSegmentIdxAndDistByOffset(start_offset+labelLength,item);
	      for(var i=idxNdistStart.index+1;i<=idxNdisEnd.index;i++)if(remaining_length>0){
	        var temp_line = [getAboveLine(item.segs[i],0,remaining_length,labelHeight)];
	        above_lines.push(temp_line.line);
	        remaining_length-=temp_line.minusLen;
	        finishOnLineBelow=temp_line.line[1];
	      }
	    }
	
	    //if we have some unsused length
	    //TODO [computeComplexPolyForLine] check if it is draw actually, so no add to polyline part (below)
	    if(remaining_length>0){
	      var last_segment_expanded = geomEssentials.expandSegment(above_lines.pop(),remaining_length);
	      above_lines.push(last_segment_expanded);
	    }
	
	    var TINY = 1; //beacouse 1px is tiny on screen
	    var poly=[geomEssentials.interpolateOnPointSegment(segStart.seg[0],segStart.seg[1],(segStart.seglen -  labelSpaceOnFirstSegment)/segStart.seglen)]; // a result! init with first point on polyline
	    poly.push(above_lines[0][0]);
	    //expand / slice lines to have a continius boundary above
	    for(var j=1;j< above_lines.length;j++){
	      var endOfPrev = above_lines[j-1][1];
	      var startOfThis =  above_lines[j][0];
	      if(startOfThis.distanceTo(endOfPrev)>TINY){
	        //add middle line
	      }else{
	        poly.push(endOfPrev);
	      }
	    }
	
	    //push last vertex of above;
	    poly.push(above_lines[j][1]);
	
	    //now add polyline pts, in reverse order
	    poly.push(finishOnLineBelow);
	    if(idxNdisEnd){ //more than 1 seg
	      for(var k=idxNdisEnd.index;k>idxNdistStart.index;k--){
	        poly.push(item.segs[k].seg[0]);
	      }
	    }
	    //now compute poly from below and above boundary
	
	    return poly; //starting with insertion point on the line
	  },
	  /**
	  computes label candidate object to place on map
	  @param {Number} i: an index in all_items array to obtain label candidate for i-item
	  @returns {candidatePosition} : generated candidate
	  */
	  computeLabelCandidate:function(i,all_items) {
	    var candidate;
	    switch (all_items[i].layertype) {
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

	/**
	Module to extract sufficient info to label data on the map
	*/
	
	"use strict";
	
	var DOMEssentials = __webpack_require__(2);
	var geomEssentials = __webpack_require__(3);
	var itemFactory = __webpack_require__(12);
	
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
	            var firstItem = itemFactory.LabelItem(node,size,layer), nextPartIndex=firstItem.readData();
	            pt.push(firstItem);
	            while(nextPartIndex){
	              var item = itemFactory.LabelItem(node,size,layer); //create node template
	              nextPartIndex=item.readData(nextPartIndex);
	              pt.push(item);
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
	      this._map._dodebug('too much OR no labels to compute('+all_items.length+')');
	      return false;
	    }
	    for(var i=0;i<all_items.length;i++){
	      var item = all_items[i];
	      if(item.layer_type()==0){//if point -> do nothing.
	        continue;
	      }
	      //else compute for lines and polygons, now it is only fo lines
	      if(item.layertype==1){
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
	      for(var k=1;k<item.data.length;k++){
	        var a = item.data[k-1], b = item.data[k];
	        item.segdata.push(geomEssentials.computeSegDataLenAngle(a,b));
	        item.totalLength+=ablen;
	      }
	  },
	
	  _getLineSegmentBoundaryPoly:function(item){
	    //TODO [_getLineSegmentBoundaryPoly]
	    // var labelLength = item.t.poly[2][0];
	  },
	
	  prepareGeneralConflictGraph:function(all_segs){
	    //TODO[prepareGeneralConflictGraph]
	  }
	}
	
	module.exports = dataReader;


/***/ },
/* 12 */
/***/ function(module, exports) {

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
	        var a = this.data[index], b = this.data[index+1];
	        return [a,b,this.segdata[index]];
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
	      item:item,
	      offset_or_origin:offset_or_origin,
	      _poly:false,
	      _computePoly:function(){
	        //TODO [_computePoly] depending on item type, compute polygon to check in annealing for this offset_or_origin
	      },
	      poly:function(){
	        if(!this._poly)this._computePoly();
	        return this._poly;
	      }
	    }
	  },
	
	}


/***/ }
/******/ ]);
//# sourceMappingURL=l.autolabelSA.js.map