//a class to perfrom geometric stuff
/** @namespace geomEssentials*/
'use strict';

var greinerHormann = require('./third_party/GreinerHormann');

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
      res[1]=this.interpolateOnPointSegment(segment[0],segment[1],(length + segment[2].seglen)/segment[2].seglen);
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
