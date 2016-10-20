//a class to perfrom geometric stuff
/** @namespace geomEssentials*/
'use strict';

var greinerHormann = require('./third_party/GreinerHormann');

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
  code from L.GeometryUtil plugin
       Returns slope (Ax+B) between two points.
        @param {L.Point} a
        @param {L.Point} b
        @returns {Object} with ``a`` and ``b`` properties.
     */
  computeSlope: function(a, b) {
      var s = (b.y - a.y) / (b.x - a.x),
          o = a.y - (s * a.x);
      return L.point(s,o);
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
    var slope1=this.computeSlope(a,b), slope2=this.computeSlope(c,d);
    if(slope1.x===slope2.x)return;
    var x = (slope2.y - slope1.y) / (slope1.x - slope2.x);
    var y = slope1.x*x + slope1.y;
    return L.point(x,y);
  },

  /**
    computes a  unit normal for [a,b] segment
    @param {L.Point} a:
    @param {L.Point} b:
    @returns {L.point}: unit normal
  */
  getNormalOnSegment:function(a,b){
    var slope = this.computeSlope(a,b);
    return this.normalizePt(slope);
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
    return (pt.x===0&&pt.y===0)?0:pt.divideBy(this.get2dVectorLength(pt));
  },

  /**
  copies segment and translates copy in normal direction by height value (may be negative)
  It also extands or shrinks new segments to make sure they are connected to each and other
  @param {Array} polyline: polyline to translate segments of which
  @param {Number} height:  height of normal
  @returns {Array}: translated copy of polyline
  */
  translateByNormals:function(polyline,height){
    var out_polyline=[];
    for(var i=0;i<polyline.length-1;i++){
      var normal = this.getNormalOnSegment(polyline[i],polyline[i+1]).multiplyBy(height);
      var current_segment=this.translateSegment(polyline[i],polyline[i+1],normal);
      //now check if current segment is connected well to previous
      if(i>0){ //so -> it isn't first segment, and out_polyline has at leat two points
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
      return L.point(
          (a.x * (1 - ratio)) + (ratio * b.x),
          (a.y * (1 - ratio)) + (ratio * b.y)
      );
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
  extractSubPolylineByOffsetValues:function(offset_start,offset_end,polyline,computed_lengths){
    var start = this.getSegmentIdxAndDistByOffset(offset_start,polyline,computed_lengths),
        end = this.getSegmentIdxAndDistByOffset(offset_end,polyline,computed_lengths),
        start_point= this.interpolateOnPointSegment(polyline[start[0]],polyline[start[0]+1],(start[1]-offset_start)/computed_lengths[start[0]]),
        end_point = this.interpolateOnPointSegment(polyline[end[0]],polyline[end[0]+1],(end[1]-offset_end)/computed_lengths[end[0]]),
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
  },

  createPoly:function(width,height){
    //TODO[createPoly]
  }

}

module.exports = geomEssentials;
