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
	var annealingManager =__webpack_require__(13);
	var dataReader = __webpack_require__(10);
	
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
	        dataReader._map=this._map;
	        var all_items  =dataReader.readDataToLabel(this._map) //array for storing paths and values
	        dataReader.prepareCurSegments(all_items,{maxlabelcount:80});
	        if(all_items.length==0){
	          this._clearNodes();
	          return;
	        }
	        var annMan = new annealingManager(all_items);
	        annMan.getInitialRandomState();
	        this._renderNodes(annMan.curset);
	        //simulatedAnnealing.perform(all_items,this.options.annealingOptions,this._renderNodes,this);
	      }else{
	        this._clearNodes();
	      }
	    },
	
	    addPolyToLayer:function(poly,overlaps,data_to_show){
	      if(!this._polyLayer){
	        this._polyLayer = L.featureGroup().addTo(this._map)
	      }
	
	      var latlngs=[]; for(var i in poly)latlngs.push(this._map.layerPointToLatLng(poly[i]));
	      map_polygon = L.polygon([latlngs],{color:'yellow',fillOpacity:'0.5'});
	      map_polygon.data_to_show = data_to_show;
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
	        if(!curID){
	          curID = labelset[m]._item.layer._path.id;
	        }else if(curID!==labelset[m]._item.layer._path.id){ //new feature -> start offset from 0
	          cur_zero_offset=0;
	          curID = labelset[m]._item.layer._path.id;
	        }else
	         cur_zero_offset+=labelset[m-1]._item.totalLength;
	         var cOffset =Math.round(cur_zero_offset+labelset[m].offset_or_origin);
	         if(this.options.showBBoxes){
	           this.addPolyToLayer(labelset[m].poly(),labelset[m].overlaps,m+'_'+labelset[m]._item.text+'_'+cOffset+'@'+labelset[m]._item.txSize.x);
	         }
	        labelset[m]._item.layer.feature.properties.alabel_offset=m+'__'+cOffset;
	        var textPath = L.SVG.create('textPath');
	        textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", '#'+curID);
	        textPath.setAttribute('startOffset',cOffset);
	        textPath.appendChild(document.createTextNode(labelset[m]._item.text));
	        var txNode = DOMEssentials.createSVGTextNode("",labelset[m]._item.style);
	        txNode.appendChild(textPath);
	        txNode.setAttribute('id','auto_label'+m);
	        svg.appendChild(txNode);
	      }
	      if(this.options.showBBoxes){
	        this._polyLayer.eachLayer(function(layer){
	            layer.bindPopup(layer.data_to_show);
	          });
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
	    return L.point(rect.width,-rect.height);
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
	  @param {Array} polyline: consists of L.Point
	  @returns {Array}: number array with length=polyline.length-1 with length of segs
	  */
	  computeSegmentsLengths:function(polyline){
	    var result=[];
	    for(var k=1;k<polyline.length;k++){
	      result.push(polyline[k].distanceTo(polyline[k-1]));
	    }
	    return result;
	  },
	
	  /**
	  translates segment to new loc by adding point to its vertices
	  @param {L.Point} a:
	  @param {L.Point} b:
	  @param {L.Point} point:
	  @returns {Array}:
	  */
	  translateSegment:function(a,b, point){
	    var result=[];
	    result.push(a.add(point)); result.push(b.add(point));
	    return result;
	  },
	
	  /**
	  using two points, computes A,B,C such as Ax+By+c=0 for these points.
	  @param {L.Point} start: first point of segment
	  @param {L.Point} finish: second point of segment
	  @returns {Array}: [A,B,C]
	  */
	  computeCanonicCoeffs:function(start,finish){
	    var ABC=[];
	    ABC.push(start.y-finish.y);
	    ABC.push(finish.x - start.x);
	    ABC.push(start.x * finish.y - finish.x * start.y);
	    return ABC;
	  },
	
	  /**
	        Returns slope (Ax+B) between two points, safe for degenerate cases
	        @param {L.Point} a
	        @param {L.Point} b
	        @returns {Object} with ``a`` and ``b`` properties.
	     */
	  computeSlope: function(start, finish) {
	     var abc = this.computeCanonicCoeffs(a,b); //ax+by+c=0 => y=-a/b x - c/b
	     if(abc[1]!=0){
	       return L.point(-abc[0]/abc[1],-abc[2]/abc[1]);
	     }
	  },
	
	
	  /**
	  computes a point where two lines intersection
	  @param {L.Point} a: a first point of first line defined by two points
	  @param {L.Point} b: a second point of first line defined by two points
	  @param {L.Point} c: a first point of second line defined by two points
	  @param {L.Point} d: a first point of second line defined by two points
	  @returns {L.Point} :intersection point or null if lines are parallel to each other
	  */
	  lineIntersection:function(a,b,c,d){
	    var abc1=this.computeCanonicCoeffs(a,b),abc2 = this.computeCanonicCoeffs(c,d);
	    var denominator = abc1[0]*abc2[1] - abc2[0]*abc1[1];
	    if(denominator==0){
	      return;
	    }
	    var x = -(abc1[2]*abc2[1] - abc2[2]*abc1[1])/denominator;
	    var y = -(abc1[0]*abc2[2] - abc2[0]*abc1[2])/denominator;
	    return L.point(x,y);
	  },
	
	  /**
	    computes a  unit normal for [a,b] segment
	    @param {L.Point} a:
	    @param {L.Point} b:
	    @returns {L.point}: unit normal
	  */
	  getNormalOnSegment:function(a,b){
	    var abc=this.computeCanonicCoeffs(a,b);
	    var normal = L.point(abc[0],abc[1]);
	    return this.normalizePt(normal);
	  },
	
	  /**
	  Computes an euclidian length of point
	  @param {L.Point} pt:
	  @returns {Number}
	  */
	  get2dVectorLength:function(pt){
	    return Math.sqrt(pt.x*pt.x + pt.y*pt.y);
	  },
	
	  /**
	  Makes this point a unit-lengthed
	  @param {L.Point} pt:
	  @returns {L.Point}:
	  */
	  normalizePt:function(pt){
	    return (pt.x===0&&pt.y===0)?L.point(0,0):pt.divideBy(this.get2dVectorLength(pt));
	  },
	
	  /**
	  copies segment and translates copy in normal direction by height value (may be negative)
	  It also extands or shrinks new segments to make sure they are connected to each and other
	  @param {Array} polyline: polyline to translate segments of which
	  @param {Number} height:  height of normal
	  @returns {Array}: translated copy of polyline
	  */
	  translateByNormals:function(polyline,height){ //TODO [translateByNormals] not working properly - when segments are fully inside polygon
	    var out_polyline=[];
	    for(var i=0;i<polyline.length-1;i++){
	      var normal = this.getNormalOnSegment(polyline[i],polyline[i+1]).multiplyBy(height);
	      var current_segment=this.translateSegment(polyline[i],polyline[i+1],normal);
	      //now check if current segment is connected well to previous
	      if(i>0){ //so -> it isn't first segment, and out_polyline has at least two points
	        var pt_intersect = this.lineIntersection(out_polyline[out_polyline.length-2],out_polyline[out_polyline.length-1],current_segment[0],current_segment[1]);
	        out_polyline[out_polyline.length-1] = pt_intersect;
	        out_polyline.push(current_segment[1]);
	      }else{
	        out_polyline.push(current_segment[0]); out_polyline.push(current_segment[1]);
	      }
	    }
	    return out_polyline;
	  },
	
	  /**
	  code from L.GeometryUtil plugin
	  @memberof geomEssentials#
	  */
	  interpolateOnPointSegment: function (a,b, ratio) {
	      var res= L.point(
	          (a.x * (1 - ratio)) + (ratio * b.x),
	          (a.y * (1 - ratio)) + (ratio * b.y)
	      );
	      return res;
	  },
	
	  /**
	  Get a segment from polyline part by it's offset
	  @param {Number} offset: na offset for the polyline
	  @param {Array} polyline: points of the polyline
	  @param {Array} computed_lengths: precomputed lengths (if available) for polyline segments
	  @returns {Array} : index of start point of segment and dist which is offset from start of the line to the end of found segment
	  */
	  getSegmentIdxAndDistByOffset:function(offset,polyline,computed_lengths){
	    var cdist=0;
	    for(var i=0;i<polyline.length-1;i++){
	      cdist+=computed_lengths[i];
	      if(offset<=cdist){
	        return [i,cdist]
	      }
	    }
	  },
	
	  /**
	  NOT USED TOFIX [getIndexBasedOnTotalLengthRandom] remove?
	  based on https://blog.dotzero.ru/weighted-random-simple/
	  get a random element from segments array of the item, assuming it is sorted lengths ascending order
	  probability is higher for longer segment
	  @param {Array} polyline: points of the polyline
	  @param {Array} computed_lengths: precomputed lengths (if available) for polyline segments
	  @param {NUmber} totalLength: precomputed total length of the polyline
	  */
	  getIndexBasedOnTotalLengthRandom:function(polyline,computed_lengths,totalLength){
	    var random_pos = Math.random()*totalLength; //get a position random for all segments of this polyline visible on the screen
	    //obtain and index of segment, to which belongs this position, it is assumed tha segments are sorted by length
	    var clen=0;
	    for(var i=0;i<polyline.length-1;i++){
	      clen+=computed_lengths[i];
	      if(clen>random_pos)break;
	    }
	    return i;
	  },
	
	  /**
	  Supplement function for extractSubPolyline
	  returns start index, end index in segments array for item, also first cropped seg and last cropped seg.
	  If only one seg here, it is crop both ends.
	  @param {Number} offset_start: should be less than total length of polyline
	  @param {Number} offset_end: should be greater than offset_start
	  @param {Array} polyline: points of the polyline
	  @param {Array} computed_lengths: precomputed lengths (if available) for polyline segments
	  @returns {Object}:
	  */
	  extractSubPolyline:function(offset_start,offset_end,polyline,computed_lengths){
	    var start = this.getSegmentIdxAndDistByOffset(offset_start,polyline,computed_lengths),
	        end = this.getSegmentIdxAndDistByOffset(offset_end,polyline,computed_lengths),
	        start_point= this.interpolateOnPointSegment(polyline[start[0]],polyline[start[0]+1],(computed_lengths[start[0]]-start[1]+offset_start)/computed_lengths[start[0]]),
	        end_point = this.interpolateOnPointSegment(polyline[end[0]],polyline[end[0]+1],(computed_lengths[end[0]]-end[1]+offset_end)/computed_lengths[end[0]]),
	        result = [start_point];
	    for(var i=start[0]+1;i<=end[0];i++){ //push every point from end of start segment to segment prior to last
	      result.push(polyline[i]);
	    }
	    result.push(end_point);
	    return result;
	  },
	
	  /**
	  Used for calculationg overlaps for text along path (textPath SVG).
	  @param {Number} start_offset: global offset for this polyline (item), same as used in rendering
	  @param {Number} end_offset: global offset for this polyline (item), same as used in rendering
	  @param {LabelItem} item:
	  @returns {Array} : a poly bounding with height of item.txSize.y
	  */
	  computeLineBoundaryPolygon:function(polyline,height){
	    var lower_boundary = polyline.slice(0);
	    var upper_boundary=this.translateByNormals(polyline,height);
	    Array.prototype.push.apply(lower_boundary, upper_boundary.reverse());
	    return lower_boundary;
	  },
	
	  clipPoly:function(poly1,poly2){
	    //TODO [clipPoly] may be we should edit actual algo -> to stop when first commpon point is found??
	    //for doing this, implement Shamos-Hoey Algorithm
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
	  check if two labels overlab, if no returns false, if yes returns ???area OR polygon??? of averlap
	  @param {} poly1:a first polygon to check overlap with second
	  @param {} poly2:a second polygon to check overlap with first
	  @returns {float}: an area of overlapping, zero if no overlapping
	  */
	  checkOverLappingArea:function(poly1,poly2,calculateAreaNotOnlyFactOfOverlapping) {
	    var clipped = this.clipPoly(poly1,poly2);
	    if(calculateAreaNotOnlyFactOfOverlapping){
	      var area =this.polyArea(clipped);
	      return area;
	    };
	    if(clipped.length>0)return 1;else return 0; //for performance, skip area calculation
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
	var annealingManager =__webpack_require__(13);
	
	var simulatedAnnealing = {
	
	  aMan:"not assigned",
	
	  /**
	  summarizing ovelapping of all layers. We store for each label it's total overlapping area with others, the sum values for all labels
	  @param {Array}:curset:
	  @returns {Array}: values of areas, last is sum
	  @memberof MapAutoLabelSupport#
	  */
	  evaluateCurSet:function(aMan){
	    aMan.curvalues=[];
	    for(var i in aMan.curset){
	      for(var j in aMan.curset){
	        if(i>j){ //to exclude variants like compare (1,3) and then (3,1)
	        var curlabel_value=(conflictMatrix[i+j]>0)?geomEssentials.checkOverLappingArea(aMan.curset[i].poly(),aMan.curset[j].poly(),false):0;
	        curvalues.push(curlabel_value);
	        }
	      }
	    }
	    this.assignCostFunctionValuesToLastEl(aMan.curvalues);
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
	  calculates total overlapping area with knowlesge of previous value and what label was moved, affects curvalues
	  @param {Array} curvalue: array of float computed at previous step or initital step, consist of elements of lower-triangluar matrix (i,j) of values of overlapping areas for (i,j) els of curset
	  @param {Array} curset: current set of label with positions
	  @param {Number} changedLabelIndex: an index of label which position we changed
	  */
	  evaluateAfterSeveralChanged:function(aMan,changedLabels) {
	    var counter=0; //index to iterate through curvalue array
	    while(changedLabels.length>0){
	      var changedLabelIndex=changedLabels.pop();
	      for(var i=0;i<aMan.curset.length;i++){
	        for(var j=0;j<aMan.curset.length;j++){if(i>j){ //i,j like we used them in the evaluateCurSet function, so we get similar counter values
	          if(i===changedLabelIndex||j===changedLabelIndex){ //here we obtain all indexes of curvales array corresponding to changedLabelIndex
	            var area=this.checkOverLappingArea(aMan.curset[i].poly(),aMan.curset[j].poly(),this.options.minimizeTotalOverlappingArea); //and recalculate areas
	            aMan.curvalues[counter]=area;
	            }
	            counter++;
	          }
	        }
	      }
	    }
	    aMan.curvalues.pop(); //remove prev sum
	    this.assignCostFunctionValuesToLastEl(aMan.curvalues);
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
	  @param {Array} items: an arr with labels and their available line segments to place
	  @returns {Array}: first is computed label placement array, 2nd is overlapping graph for this array, third is number of iterations.
	  */
	  _doAnnealing:function(items){
	    //init
	    var annManager = new annealingManager(items);
	        annManager.getInitialRandomState(); //current label postions
	        this.evaluateCurSet(annManager); //current overlaping matrix (conflict graph)
	    var t=this.options.t0, stepcount=0, doexit=annManager.overlap_count()=== 0,//if no overlaping at init state, do nothing and return current state
	        iterations=0;
	
	    var doReturn = function(){
	          annManager.markOveralppedLabels();
	          annManager.iterations=iterations;
	          return annManager;
	        }
	
	    while(true){
	     if(t<=this.options.tmin || stepcount>=this.options.maxsteps){
	        return doReturn();
	      }
	      stepcount++;
	      var improvements_count=0, no_improve_count=0;
	      for(var i=0;i<this.options.constant_temp_repositionings*curset.length;i++){ //while constant temperature, do some replacments
	        annManager.saveOld();
	        var overlapped_indexes = annManager.getOverlappingLabelsIndexes();
	        annManager.applyNewPositionsForLabelsInArray(overlapped_indexes);
	        this.evaluateAfterSeveralChanged(annManager,overlapped_indexes);
	        iterations++;
	        if(aMan.overlap_count() === 0){ return doReturn(); }
	        if(iterations>this.options.maxtotaliterations){ return doReturn(); }
	        var delta = (annManager.old_overlap_count() - annManager.overlap_count());
	        if(delta<0){//ie, new labeling is worse!
	          var P=1 - Math.exp(delta/t);
	          if(P>Math.random()){ //undo label reposition with probability of P
	            annManager.restoreOld();
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
	            return doReturn();
	        }
	        if(improvements_count>=this.options.max_improvments_count*curset.length){
	          break; //of for
	        }
	      }
	      t*=this.options.decrease_value; //decrease temp
	    };
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
	          var annRes = this._doAnnealing(all_item);
	          this.dodebug('overlapping labels count = '+annRes.overlap_count()+', total labels count = '+annRes.curset.length+', iterations = '+annRes.iterations);
	          this.dodebug('time to annealing = '+(performance.now()-t0));
	          callback.call(context,annRes.curset);
	          }
	      }
	  }
	
	
	//module.exports = simulatedAnnealing;


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	/**
	Module to extract sufficient info to label data on the map
	*/
	
	"use strict";
	
	var DOMEssentials = __webpack_require__(2);
	var geomEssentials = __webpack_require__(3);
	var itemFactory = __webpack_require__(11);
	
	var dataReader = {
	  /**
	  creates an array of features's segments for each feature  of layers2label's layers on screen along with SVG text corresponding to
	  @returns [Array] returns an array with values : {t:{content_node:SVG textnode},parts:feature parts,layertype}, then, in next funcs we add apoly param to t object, ir, its bounding polygon, layertype = 0 marker, 1 polyline, 2 polygon
	  */
	  readDataToLabel:function(){
	    var pt  =[],count=0;
	    if(this._map){
	      for(var i in this._map.autoLabeler._layers2label)
	      if(this._map.getZoom()>this._map.autoLabeler._layers2label[i]._al_options.zoomToStartLabel)
	      {
	        var lg=this._map.autoLabeler._layers2label[i],
	            map_to_add = this._map;
	        lg.eachLayer(function(layer){
	          if(layer.feature)
	          if(layer.feature.properties[lg._al_options.propertyName]){
	            var text=layer.feature.properties[lg._al_options.propertyName],
	                style=lg._al_options.labelStyle,
	                node = DOMEssentials.createSVGTextNode(text,style),
	                size = DOMEssentials.getBoundingBox(map_to_add,node); //compute ortho aligned bbox for this text, only once, common for all cases
	            if(layer._path)if(layer._parts.length>0){
	              var id = 'pathautolabel-' + L.Util.stamp(layer);
	              layer._path.setAttribute('id',id);
	              layer.feature.properties.alabel_offset="";
	              count++;
	            }
	            var firstItem = itemFactory.labelItem(text,style,size,layer,pt)
	            if(firstItem){
	              //TOOO [readData] if last point of prev part is equal to fisrt of next part -> use one item for these
	              var nextPartIndex=firstItem.readData();
	              pt.push(firstItem);
	              while(nextPartIndex){
	                var item = itemFactory.labelItem(text,style,size,layer,pt); //create node template
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
	    var i=all_items.length-1;
	    while(i>=0)
	    {
	      all_items[i].applyFeatureData();
	      if(all_items[i].ignoreWhileLabel)all_items.splice(i,1); //remove if item does not suit it's label for some reason
	      i--;
	    }
	    return true;
	  },
	}
	
	module.exports = dataReader;


/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	/*
	modlue to create labelItems convenient for labelling and calculation
	*/
	
	var geomEssentials = __webpack_require__(3);
	
	module.exports = {
	  /**
	  a factory function for label items
	  @param {String} text:
	  @param {String} style: text style
	  @param {L.Point} txSize: size of bounding box for txNode
	  @param {L.Layer} layer: a feature (Marker, Polyline, Path) to aquire data
	  */
	  labelItem:function(text,style,txSize,layer,hostArray){
	    var basic_item= {
	      data:[],
	      text:text,
	      style:style,
	      txSize:txSize,
	      layer:layer,
	      host:hostArray,
	      _itemPoly:false, //all available textlabel positions for this label
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
	          while((this.layer._parts[partIndex][this.layer._parts[partIndex].length-1].distanceTo(this.layer._parts[nextPart][0])<5)
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


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	var geomEssentials = __webpack_require__(3);
	var itemFactory = __webpack_require__(11);
	
	var candidateGenerator = {
	  options:{
	    lineDiscreteStepPx:3
	  },
	
	  obtainCandidateForPoint:function(point){
	    //TODO[obtainCandidateForPoint]
	  },
	
	  obtainCandidateForPoly:function(polygon){
	    //TODO[obtainCandidateForPoly]
	  },
	
	  /**
	  Get a poly (simple with no text along path)for random offset on the polyline
	  @param {Object} item: item from prepareCurSegments's allsegs
	  @returns {Array} : a poly bounding text, placed on corresponding point for offset on poluline and rotated to match segment's skew
	  */
	  obtainCandidateForPolyLineByRandomStartOffset:function(item){
	    var random_offset =(item.totalLength - item.txSize.x>0) ?  (item.totalLength - item.txSize.x)*Math.random():0;
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
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	var candidateGenerator = __webpack_require__(12);
	
	var annealingManager = function(all_items){
	  var result = {
	    items:all_items,
	    curset:[],
	    curvalues:[],
	    conflictMatrix:[],
	    _oldvalues:[],
	    _oldset:[],
	    overlap_count:function(){
	      return (this.curvalues.length>0)?this.curvalues[this.curvalues.length-1]:0;
	    },
	
	    saveOld:function(){
	      this._oldvalues = this.curvalues.slice(0);
	      this._oldset = this.curset.slice(0);
	    },
	
	    restoreOld:function(){
	      this.curvalues = this._oldvalues;
	      this.curset = this._oldset;
	    },
	
	    old_overlap_count:function(){
	      return (this._oldvalues.length>0)?this._oldvalues[this._oldvalues.length-1]:0;
	    },
	    /**
	    computes the random set of positions for text placement with angles and text values
	    @param {Array} all_items: an array with {t,segs} elements, according to t -text of the polyline, segs - its accepted segments to label on. Result array is generated from items of aMan array
	    @returns {Array} : an array with elements such as return values of computeLabelCandidate function
	    */
	    getInitialRandomState:function(){
	      this.curset=[];
	      for(var i=0;i<this.items.length;i++){
	        var candidate = candidateGenerator.computeLabelCandidate(i,this.items);
	        this.curset.push(candidate);
	      }
	    },
	
	    /**
	    Divides all_items into clusters (or builds a graph), such as:
	    cluster consists of items with potential label intersections, which are computed by intersecting each item's boundaries (itemPoly)
	    Also: if free-of-intersections part of item's poly is capable for containing item's label, then such item is moved to separate cluster
	    with only aMan item -> no further computation for aMan item at all
	    After finishing clustering -> we applying simulatedAnnealing to each cluster independently, and thus, potentially, we
	    decrease degree of a problem.
	    @param {Array} all_items:
	    @returns {Array}: two-dim array if clusters first level, indices of items secodn level.
	    */
	    compConflictMatrix:function(){
	      this.conflictMatrix=[];
	      //no need to intersect i,j items and j,i items
	      for(var i in this.items){
	        for(var j in this.items)if(i>j){
	          var curClip=geomEssentials.clipPoly(this.items[i].getItemPoly(),this.items[j].getItemPoly());
	          if(curClip.length>0){
	            //on each intersection compute free space for this item
	            if(!this.items[i].free_space)this.items[i].free_space = curClip;
	            else this.items[i].free_space = geomEssentials.subtractPoly(this.items[i].free_space,curClip);
	          }
	          this.conflictMatrix.push(curClip.length); //if zero -> no need to check overlappings for i,j with index i+j.
	        }
	      }
	    },
	
	    markOveralppedLabels:function(){
	      var counter=0;
	      for(var i in this.curset){
	        for(var j in this.curset){
	          if(i>j){
	            if(this.curvalues[counter]>0){
	              this.curset[i].overlaps = true;
	              this.curset[j].overlaps = true;
	            }
	            counter++;
	          }
	        }
	      }
	    },
	
	    getOverlappingLabelsIndexes:function(){
	      var counter=0, result=[];
	      for(var i in this.curset)
	        for(var j in this.curset)
	          if(i>j){
	            if(this.curvalues[counter]>0){
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
	    swapCandidateInLabelSetToNew:function(idx){
	      var label_index = this.curset[idx].all_items_index();
	      var new_candidate = candidateGenerator.computeLabelCandidate(label_index,this.items);
	      this.curset[idx]=new_candidate;
	    },
	
	    applyNewPositionsForLabelsInArray:function(idx_array){
	      for(var i in idx_array)this.swapCandidateInLabelSetToNew(idx_array[i]);
	    }
	  };
	  return result;
	}
	
	module.exports = annealingManager;


/***/ }
/******/ ]);
//# sourceMappingURL=l.autolabelSA.js.map