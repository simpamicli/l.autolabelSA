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
	
	   //TODO [general] test with diffenrent files
	   //TODO [general] add point and polygon labeling
	   //TODO [general] add text along path support
	
	  var DOMEssentials = __webpack_require__(1);
	  var geomEssentials = __webpack_require__(2);
	  var simulatedAnnealing = __webpack_require__(3);
	  var dataReader = __webpack_require__(4);
	
	
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
	      this._al_options.labelsDelay = opts.labelsDelay || 1000; //a time after update event of renderer when labelling should start, if zero - errors while zooming
	      this._al_options.checkLabelsInside = opts.checkLabelsInside || true; //re-clip all segments to entirely fit map window without padding,
	                                                                           //disabling increases performance, but some labels maybe invisible due to padding of renderer
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
	      this._autoLabel=false;
	    },
	
	    /*
	    beacuse we using update event of renderer, here we switching to map context and handling two-time update event of SVG renderer
	    */
	    _apply_doAutoLabel:function(){
	      if(this._map._ctimerID!=-1)clearTimeout(this._map._ctimerID);
	      if(this._map._zoomstarttrig==0){
	        var _this=this._map;
	        this._map._ctimerID=setTimeout(function(){_this._doAutoLabel()},this._al_options.labelsDelay);
	      }
	      this._map._clearNodes();
	    },
	
	    _dodebug:function(message){
	      if(this._al_options.debug)console.log(message);
	    },
	
	    /**
	    this function obtains visible polyline segments from screen and computes optimal positions and draws labels on map
	    */
	    _doAutoLabel:function() {
	      if(!this._autoLabel)return; //nothing to do here
	      if(this.getZoom()>this._al_options.zoomToStartLabel){
	        dataReader._map=this;
	        var pt  =dataReader.readDataToLabel() //array for storing paths and values
	        var allsegs=dataReader.prepareCurSegments(pt,{maxlabelcount:50});
	        if(allsegs.length==0){
	          this._clearNodes();
	          return;
	        }
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


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	//a class to compute pixel dimensions of texts
	/** @namespace DOMEssentials*/
	'use strict';
	var geomEssentials = __webpack_require__(2);
	
	var DOMEssentials = {
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
	  @param {Object} t: consist of content_node (SVG text) and this function is adding a new property called 'poly' contatining bbox in format [four points of bbox]
	  @returns {Array} poly: a bbox for t.content_node
	  @memberof DOMEssentials#
	  */
	  getBoundingBox:function(map,node){
	    var svg = map.options.renderer._container;
	    svg.appendChild(node);
	    var rect = node.getBoundingClientRect();
	    var ortho_poly = this.convertClientRectToArrayOfArrays(rect);
	    svg.removeChild(node);
	    return ortho_poly;
	  },
	
	  createSVGTextNode:function(text,textstyle){
	    text = text.replace(/ /g, '\u00A0');  // Non breakable spaces
	    var node =L.SVG.create('text');
	    node.setAttribute('style',textstyle);
	    node.textContent = text;
	    return node;
	  }
	}
	
	module.exports = DOMEssentials;


/***/ },
/* 2 */
/***/ function(module, exports) {

	//a class to perfrom geometric stuff
	/** @namespace geomEssentials*/
	'use strict';
	var geomEssentials = {
	
	  /**
	  code from leaflet src, without some lines
	  we assume here, that clipPoints was already invoked
	  */
	  clipClippedPoints: function (layer_parts,bounds) {
	    var parts = [], i, j, k=0,len, len2, segment,points;
	    for (i = 0, k = 0, len = layer_parts.length; i < len; i++) {
				points = layer_parts[i];
	  		for (j = 0, len2 = points.length; j < len2 - 1; j++) {
	  			segment = L.LineUtil.clipSegment(points[j], points[j + 1], bounds, j, true);
	  			if (!segment) { continue; }
	  			parts[k] = parts[k] || [];
	  			parts[k].push(segment[0]);
	  			// if segment goes out of screen, or it's the last one, it's the end of the line part
	  			if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
	  				parts[k].push(segment[1]);
	  				k++;
	  			}
	  		}
	    }
	    return parts;
		},
	
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
	  moves a poly by translating all its vertices to moveto
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
	  code from L.GeometryUtil plugin
	  @memberof geomEssentials#
	  */
	  computeAngle: function(a, b) {
	      return (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);
	  },
	
	  /**
	  code from L.GeometryUtil plugin
	  @memberof geomEssentials#
	  */
	  interpolateOnPointSegment: function (pA, pB, ratio) {
	      return L.point(
	          (pA.x * (1 - ratio)) + (ratio * pB.x),
	          (pA.y * (1 - ratio)) + (ratio * pB.y)
	      );
	  },
	
	  /**
	  function from https://rosettacode.org/wiki/Sutherland-Hodgman_polygon_clipping#JavaScript
	  @param {Array} subjectPolygon: first poly
	  @param {Array} clipPolygon: second poly
	  @returns {Array} : result poly
	  @memberof geomEssentials#
	  */
	  clipPoly:function(subjectPolygon, clipPolygon) {
	    var cp1, cp2, s, e;
	    var inside = function (p) {
	        return (cp2[0]-cp1[0])*(p[1]-cp1[1]) > (cp2[1]-cp1[1])*(p[0]-cp1[0]);
	    };
	    var intersection = function () {
	        var dc = [ cp1[0] - cp2[0], cp1[1] - cp2[1] ],
	            dp = [ s[0] - e[0], s[1] - e[1] ],
	            n1 = cp1[0] * cp2[1] - cp1[1] * cp2[0],
	            n2 = s[0] * e[1] - s[1] * e[0],
	            n3 = 1.0 / (dc[0] * dp[1] - dc[1] * dp[0]);
	        return [(n1*dp[0] - n2*dc[0]) * n3, (n1*dp[1] - n2*dc[1]) * n3];
	    };
	    var outputList = subjectPolygon;
	    cp1 = clipPolygon[clipPolygon.length-1];
	    for (var j in clipPolygon) {
	        var cp2 = clipPolygon[j];
	        var inputList = outputList;
	        outputList = [];
	        s = inputList[inputList.length - 1]; //last on the input list
	        for (var i in inputList) {
	            var e = inputList[i];
	            if (inside(e)) {
	                if (!inside(s)) {
	                    outputList.push(intersection());
	                }
	                outputList.push(e);
	            }
	            else if (inside(s)) {
	                outputList.push(intersection());
	            }
	            s = e;
	        }
	        cp1 = cp2;
	    }
	    return outputList
	  },
	
	  /**
	  code from http://www.codeproject.com/Articles/13467/A-JavaScript-Implementation-of-the-Surveyor-s-Form
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
	      for( k = 0; k < poly.length-1; k++ ) {
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
	  }
	}
	
	module.exports = geomEssentials;


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var geomEssentials = __webpack_require__(2);
	
	//TODO [simulatedAnnealing] maybe do as factory function - to perform independently for different map instances
	var simulatedAnnealing = {
	
	  obtainCandidateForPolyLine:function(seg_w_len,labelLength){
	    if(!seg_w_len){
	      return;
	    }
	    var seg = seg_w_len.seg, seglen = seg_w_len.seglen;
	    var segStartPt = seg[0],segEndPt=seg[1];
	    if(segStartPt.x>segEndPt.x){
	      var tmp=segStartPt; segStartPt=segEndPt; segEndPt=tmp; //be sure that text is always left-to-right
	    }
	    var p2add;
	    //now we need not let label exceed segment length. If seg is too small, the ratio shoud be zero
	    //so, calculate ratio as following:
	    if(labelLength>=seglen){
	      p2add = segStartPt;
	    }else{
	      var ratio = Math.random();
	      var allowed_max_ratio = (seglen - labelLength)/seglen;//is less than 1
	      //so
	      ratio*=allowed_max_ratio;
	      p2add = geomEssentials.interpolateOnPointSegment(segStartPt,segEndPt,ratio); //get actual insertion point for label
	    }
	    var angle = geomEssentials.computeAngle(segStartPt,segEndPt); //get its rotation around lower-left corner of BBox
	    return {p2add:p2add,angle:angle};
	  },
	
	  obtainCandidateForPoint(point){
	    //TODO[obtainCandidateForPoint]
	  },
	
	  obtainCandidateForPoly(ring){
	    //TODO[obtainCandidateForPoly]
	  },
	  /**
	  computes label candidate object to place on map
	  TODO [computeLabelCandidate] place label on both sides of segment
	  TODO [computeLabelCandidate] check label not to exceed side of the screen, maybe slide along segment
	  TODO [computeLabelCandidate] add polygon support: if two or more independent areas of one poly on screen, label both
	  @param {Number} i: an index in allsegs array to obtain label for candidate and segments array wuth segments to choose
	  @returns {Object} : an object with {t,poly,pos,a,allsegs_index} elements, such as t - text to label,poly - bounding rect of label, pos - pos to place label, a - angle to rotate label,allsegs_index - index in segments array
	  @memberof MapAutoLabelSupport#
	  */
	  computeLabelCandidate:function(i,allsegs) {
	    var t = allsegs[i].t; //label part
	    var segs = allsegs[i].segs;
	    var idx = Math.floor((Math.random() * segs.length) ); //choose the segment index from parts visible on screeen
	    var poly,point_and_angle;
	    poly = allsegs[i].t.poly;
	
	    switch (allsegs[i].layertype) {
	      case 0:
	        break;
	      case 1:
	        point_and_angle=this.obtainCandidateForPolyLine(segs[idx],t.poly[2][0]);
	        break;
	      case 2:
	        break;
	    }
	
	    if(point_and_angle.angle)poly=geomEssentials.rotatePoly(poly,[0,0],point_and_angle.angle); //rotate if we need this
	    poly=geomEssentials.movePolyByAdding(poly,[point_and_angle.p2add.x,point_and_angle.p2add.y]);
	    //TODO [computeLabelCandidate] check, if any of poly points outside the screen, if so, slide it along the segment to achieve no point such
	    var res={t:t,poly:poly,pos:point_and_angle.p2add,a:point_and_angle.angle,allsegs_index:i};
	    return res;
	  },
	
	  /**
	  clones element of curset
	  @param {Number} index:
	  @param {Array} curset:
	  @returns {Object}:
	  @memberof MapAutoLabelSupport#
	  */
	  copyCandidate:function(index,curset) {
	    var cancopy = curset[index];
	    cancopy.poly = curset[index].poly.slice(0);
	    return cancopy;
	  },
	
	  /**
	  computes the random set of positions for text placement with angles and text values
	  @param {Array} allsegs: an array with {t,segs} elements, according to t -text of the polyline, segs - its accepted segments to label on. Result array is generated from items of this array
	  @returns {Array} : an array with elements such as return values of computeLabelCandidate function
	  @memberof MapAutoLabelSupport#
	  */
	  getInitialRandomState:function(allsegs){
	    var res=[];
	    for(var i=0;i<allsegs.length;i++){
	      var candidate = this.computeLabelCandidate(i,allsegs);
	      res.push(candidate);
	    }
	    return res;
	  },
	
	  /**
	  swaps position for a random label with another from this label's positions pool
	  @param {Number} index : index of label in allsegs to select new random position from availavle choices.
	  @param {Array} curset: currently selected label postions
	  @param {Array} allsegs: all available postions
	  @memberof MapAutoLabelSupport#
	  */
	  swapCandidateInLabelSet:function(idx,curset,allsegs){
	    var label_index = curset[idx].allsegs_index;
	    var new_candidate = this.computeLabelCandidate(label_index,allsegs);
	    curset[idx]=new_candidate;
	  },
	
	  /**
	  check if two labels overlab, if no returns false, if yes returns ???area OR polygon??? of averlap
	  @param {} poly1:a first polygon to check overlap with second
	  @param {} poly2:a second polygon to check overlap with first
	  @returns {float}: an area of overlapping, zero if no overlapping
	  @memberof MapAutoLabelSupport#
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
	  @memberof MapAutoLabelSupport#
	  */
	  assignCostFunctionValuesToLastEl:function(overlapping_values){
	    var res=0;
	    for(var i=0;i<overlapping_values.length;i++)if(i<overlapping_values.length){
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
	    var res=0;
	    var overlap_values=[];
	    for(var i=0;i<curset.length;i++){
	      for(var j=0;j<curset.length;j++){
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
	
	  /**
	  calculates total overlapping area with knowlesge of previous value and what label was moved
	  @param {Array} curvalue: array of float computed at previous step or initital step, consist of elements of lower-triangluar matrix (i,j) of values of overlapping areas for (i,j) els of curset
	  @param {Array} curset: current set of label with positions
	  @param {Number} changedLabelIndex: an index of label which position we changed
	  @returns {Array} : curvalues, recalculated
	  @memberof MapAutoLabelSupport#
	  */
	  evaluateAfterOneChanged:function(curvalues,curset,changedLabelIndex) {
	    var counter=0; //index to iterate through curvalue array
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
	    this.options.max_noimprove_count = this.options.max_noimprove_count || 50;
	    this.options.maxsteps = this.options.maxsteps || 100;
	    this.options.maxtotaliterations = this.options.maxtotaliterations || 100000;
	    this.options.minimizeTotalOverlappingArea=this.options.minimizeTotalOverlappingArea || false;
	    this.options.debug=this.options.debug || true;
	    this.options.allowBothSidesOfLine=this.options.allowBothSidesOfLine || true;
	  },
	
	  stopCalc:function(timerID,callback){
	
	  },
	
	  /**
	  find optimal label placement based on simulated annealing approach, relies on paper https://www.eecs.harvard.edu/shieber/Biblio/Papers/jc.label.pdf
	  @param {Array} allsegs: an arr with labels and their available line segments to place
	  @param {Object} options: TODO [simulatedAnnealing] add options description
	  @param {Object} callback: a function to gather results and use them to render
	  @param {Object} context: a parent conext of the function  above (arguments.callee - but deprecated)
	  @memberof MapAutoLabelSupport#
	  */
	  perform:function(allsegs,options,callback,context) {
	        if(allsegs.length<1){callback([])}else{
	          var t0 = performance.now();
	          this.processOptions(options);
	          //init
	          var curset=this.getInitialRandomState(allsegs); //current label postions
	          var curvalues = this.evaluateCurSet(curset); //current overlaping matrix
	          var t=options.t0;
	          var stepcount=0;
	          var doexit=curvalues[curvalues.length-1] === 0;//if no overlaping at init state, do nothing and return curretn state
	          var iterations=0;
	          var This=this;
	          var oldCenter = context.getCenter(), oldZoom = context.getZoom();
	          var doReturn = function(dorender){
	            This.dodebug('-----');
	            if(dorender){
	              This.dodebug('overlapping labels count = '+curvalues.pop()+', total labels count = '+curset.length+', iterations = '+iterations);
	              var t1 = performance.now();
	              This.dodebug('time to annealing = '+(t1-t0));
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
	            if(t<=options.tmin || stepcount>=options.maxsteps)return;
	            stepcount++;
	            var improvements_count=0;
	            var no_improve_count=0;
	            for(var i=0;i<options.constant_temp_repositionings*curset.length;i++){
	              var oldvalues = curvalues.slice(0); //clone curvalues in order to return to ld ones
	              var random_label_ind = Math.floor((Math.random() * curset.length) ); //randomly choose one label
	              var old_pos = This.copyCandidate(random_label_ind,curset);
	              This.swapCandidateInLabelSet(random_label_ind,curset,allsegs); //change label position
	              This.evaluateAfterOneChanged(curvalues,curset,random_label_ind); //calc new sum
	              iterations++;
	              if(curvalues[curvalues.length-1] === 0){
	                This.dodebug('strict solution');
	                doReturn(dorender);
	                return;
	              }
	              var delta = (oldvalues[oldvalues.length-1]-curvalues[curvalues.length-1]);
	              if(delta<0){//ie, new labeling is worse!
	                var P=1 - Math.exp(delta/t);
	                if(P>Math.random()){ //undo label reposition with probability of P
	                  curvalues = oldvalues;
	                  curset[random_label_ind]=old_pos;
	                  no_improve_count++;
	                }else { //approve new repositioning
	                  improvements_count++;
	                  no_improve_count=0;
	                }
	              }else{
	                 improvements_count++;
	                 no_improve_count=0;
	               }
	              if(no_improve_count>=options.max_noimprove_count*curset.length){ //it is already optimal
	                This.dodebug('stable state, finish on it');
	                doReturn(dorender);
	                return;
	              }
	              if(improvements_count>=options.max_improvments_count*curset.length){
	                //immediately exit cycle and decrease current t
	                doReturn(dorender);
	                return;
	              }
	            }
	            //decrease t
	            t*=options.decrease_value;
	            if(iterations>5000){
	              doReturn(dorender);
	              return;
	            }
	          };
	      }
	  }
	}
	
	module.exports = simulatedAnnealing;


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	/**
	Module to extract sufficient info to label data on the map
	*/
	var DOMEssentials = __webpack_require__(1);
	var geomEssentials = __webpack_require__(2);
	
	var dataReader = {
	  /**
	  creates an array of features's segments for each feature  of layers2label's layers on screen along with SVG text corresponding to
	  @returns [Array] returns an array with values : {t:{content_node:SVG textnode},parts:feature parts,layertype}, then, in next funcs we add apoly param to t object, ir, its bounding polygon, layertype = 0 marker, 1 polyline, 2 polygon
	  @memberof MapAutoLabelSupport#
	  */
	  readDataToLabel:function(){
	    var pt  =[];
	    if(this._map){
	      var bounds_to_contain_labels = geomEssentials.getBoundsWithoutPadding(this._map,0.9); // if needed
	      for(var i=0;i<this._map._layers2label.length;i++){
	        var lg=this._map._layers2label[i];
	        var ll2 = this._map._layers2label;
	        var map_to_add = this._map;
	        lg.eachLayer(function(layer){
	          if(layer.feature)
	          if(layer.feature.properties[lg._al_options.propertyName]){
	            var node =DOMEssentials.createSVGTextNode(layer.feature.properties[lg._al_options.propertyName],lg._al_options.labelStyle);
	            var poly = DOMEssentials.getBoundingBox(map_to_add,node); //compute ortho aligned bbox for this text, only once, common for all cases
	            var layer_type = 0;
	            var centerOrParts=[];
	            if(layer instanceof L.Polyline || layer instanceof L.Polygon){ //polyline case
	                if(layer._parts.length>0){ //so, line is visible on screen and has property to label over it
	                  layer_type = layer instanceof L.Polygon?2:1; //0 goes to marker or circlemarker
	                  //TEMPORARY TOFIX
	                  if(layer_type==1 && this._map._al_options.checkLabelsInside){
	                      centerOrParts = geomEssentials.clipClippedPoints(layer._parts,bounds_to_contain_labels);
	                  }
	                  else centerOrParts=layer._parts; //for polygon
	                }
	              }
	            else if (layer instanceof L.CircleMarker || L.Marker){
	              centerOrParts = this._map.latLngToLayerPoint(layer.getLatLngs()); //so we adding only L.Point obj
	            }
	
	            if(centerOrParts.length>0){
	              var toAdd = {t:{content_node:node,poly:poly},parts:centerOrParts, layertype: layer_type};
	              pt.push(toAdd);
	            }
	            }
	          }
	        );
	      }
	    }
	    return pt;
	  },
	
	  /**
	  extracts good segments from available polyline parts and converts to use in next procedures of pos estimation
	  @param {Array} ptcollection: each item is conatiner with t:label to draw for this polyline, parts - parts of this pline visible on screen in pixel coords
	  @param {Set} options: options are: {float} minSegLen: if segment length less than this, it is skipped except it is the only one for current polyline, {integer} maxlabelcount: if more labels in ptcollection, then do nothing
	  @memberof MapAutoLabelSupport#
	  */
	  prepareCurSegments(ptcollection,options){
	    options = options || {};
	    options.maxlabelcount=options.maxlabelcount || 100;
	    if(ptcollection.length>options.maxlabelcount){ //FIXME [prepareCurSegments] not aproper way to do things, to overcome two time rendering while zooming
	      this._map.dodebug('too much labels to compute('+ptcollection.length+'>'+options.maxlabelcount+')');
	      return [];
	    }
	    var allsegs=[];
	    for(var i=0;i<ptcollection.length;i++){
	      var item = ptcollection[i];
	      if(item.layertype==0){//if point -> do nothing.
	        allsegs.push({t:item.t,origin:t.parts,layertype:item.layertype});
	        continue;
	      }
	      //else compute for lines and polygons
	      //TODO[prepareCurSegments] add valid parsing for polygon case
	      //TODO[prepareCurSegments]IMPORTANT clip _parts angain to about 0.9 size of screen bbox
	      //now it is only fo lines
	      if(item.layertype==1){
	        var cursetItem=[]; //set of valid segments for this item
	        var too_small_segments=[]; //set of segment which length is less the label's lebgth of corresponding feature
	        var labelLength = item.t.poly[2][0];
	        for(var j=0;j<item.parts.length;j++){ //here we aquire segments to label
	          var curpart = item.parts[j];
	          for(var k=1;k<curpart.length;k++){
	            var a = curpart[k-1];
	            var b = curpart[k];
	            var ab = [a,b];
	            var ablen = a.distanceTo(b); //compute segment length only once
	            var what_to_push ={seg:ab,seglen:ablen};
	            if(ablen>labelLength)cursetItem.push(what_to_push);else too_small_segments.push(what_to_push);
	          }
	        }
	      }
	
	      var to_all_segs = {t:item.t,layertype:item.layertype};
	      if(cursetItem.length>0)to_all_segs.segs=cursetItem;else to_all_segs.segs=too_small_segments;
	      allsegs.push(to_all_segs);
	    }
	    return allsegs;
	  },
	}
	
	module.exports = dataReader;


/***/ }
/******/ ]);
//# sourceMappingURL=l.autolabelSA.js.map