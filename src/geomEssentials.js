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
    this.polyLPointToArray(lower_boundary);
    return lower_boundary;
  },

  /*
  Converts poly of L.Point to poly of [x,y]. Note - original variable is to be modified
  @param {Array} polyLPoint: poly to modify
  **/
  polyLPointToArray:function(polyLPoint){
    for(var i=0;i<polyLPoint.length;i++)
      polyLPoint[i] = [polyLPoint[i].x,polyLPoint[i].y];
  },

  /**
function from https://rosettacode.org/wiki/Sutherland-Hodgman_polygon_clipping#JavaScript
@param {Array} subjectPolygon: first poly
@param {Array} clipPolygon: second poly
@returns {Array} : result poly
@memberof geomEssentials#
*/
clipPoly2:function(subjectPolygon, clipPolygon) {
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
    var res=[];
    for(var i=0;i<poly.length;i++){
      res.push([poly[i][0] + pt2add.x,poly[i][1] + pt2add.y]);    
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
    moveto.x = moveto.x-poly[0][0];
    moveto.y = moveto.y-poly[0][1];
    for(var i=1;i<poly.length;i++){
      res[i][0]+=moveto.x; res[i][1]+=moveto.y;
    }
    return res;
  },

  /**
  @param {L.Bounds} bounds
  */
  boundsToPointArray:function (bounds) {
    var min = bounds.min, max = bounds.max;
    var result = [[min.x,min.y], [min.x,max.y], [max.x,max.y], [max.x,min.y]];
    return result;
  },

  clipBounds:function(b1,b2){
    if(b1.overlaps(b2)){
      return new L.bounds([Math.max(b1.min.x,b2.min.x),Math.max(b1.min.y,b2.min.y)],
                          [Math.min(b1.max.x,b2.max.x),Math.min(b1.max.y,b2.max.y)]);
    }return false;
  },

  /**
  computex a domain poly (contains all available text positions for this pt)
  @param {L.Point} pt
  @param {L.Point} txSize
  @param {L.Bounds} mapbounds
  @returns {L.bounds} : polygon
  */
  getPointTextDomain:function(pt,txSize,mapbounds){
    var temp_bounds = L.bounds(pt,pt.add(txSize));
    temp_bounds.extend(pt.subtract(txSize));
    return this.clipBounds(temp_bounds,mapbounds);
  },

  /**
  @param {L.Point} pt
  @param {L.Point} txSize
  @returns {Array} : polygon
  */
  getSimplePolyText:function(pt,txSize){
    var temp_bounds = L.bounds(L.point(0,0),(txSize));
    return this.boundsToPointArray(temp_bounds);
  },

  getAvailableTextOriginBounds(textDomain,txSize){
    var maxOriginValue = L.point(textDomain.max.x-txSize.x,textDomain.max.y + txSize.y);
    return L.bounds(textDomain.min,maxOriginValue);
  }
}

module.exports = geomEssentials;
