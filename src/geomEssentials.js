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
    var ablen = a.distanceTo(b), //compute segment length only once
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
    var result=segment.slice(0);
    result[0] = result[0].add(point);
    result[1] = result[1].add(point);
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
      return L.point(s,o);
  },

  getNormalOnSegment:function(segment){
    var slope = this.computeSlope(segment[0],segment[1]);
    return this.normalizePt(slope);
  },

  get2dVectorLength:function(pt){
    return Math.sqrt(pt.x*pt.x + pt.y*pt.y);
  },

  normalizePt:function(pt){
    var res = this.get2dVectorLength(pt);
    var res1 = pt.divideBy(res);
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
    return this.translateSegment(segment,normal);
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
  Supplement function for extractSubPolyline
  returns start index, end index in segments array for item, also first cropped seg and last cropped seg.
  If only one seg here, it is crop both ends.
  @param {Number} offset_start:
  @param {Number} offset_end:
  @param {labelItem} item: item layer_type 1 with data and segdata fill
  @returns {Object}:
  */
  getOffsetWindowOnPolylineWithBorderSegments:function(offset_start,offset_end,item){
    var start = item.getSegmentIdxAndDistByOffset(offset_start),
        end = item.getSegmentIdxAndDistByOffset(offset_end),
        firstSeg = item.getSegment(start.index);
        firstSeg[0] = this.interpolateOnPointSegment(firstSeg,(start.dist-offset_start)/firstSeg[2].seglen);
        var lastSeg;
        if(start.index!==end.index){
          lastSeg = item.getSegment(end.index);
          if(!lastSeg[2]){
            console.log('qweqwe');
          }
          lastSeg[1] = this.interpolateOnPointSegment(lastSeg,(end.dist-offset_end)/lastSeg[2].seglen);
        }else{
          firstSeg[1]=this.interpolateOnPointSegment(firstSeg,(end.dist-offset_end)/firstSeg[2].seglen);
        }
        return {start:start,end:end,firstSeg:firstSeg,lastSeg:lastSeg};
  },

  /**
  extracts sub-polyline frim give item's data line
  @param {Object} offsetwindow:
  @param {labelItem} item: item layer_type 1 with data and segdata fill
  @returns {Array}: array of L.Point
  */
  extractSubPolylineByOffsetWindow:function(offsetWindow,item){
    var result = offsetWindow.firstSeg.slice(0,1);
    if(!offsetWindow.lastSeg)return result; //one segment case
    //and if we have segments in between first/last:
    for(var i=offsetWindow.start.index+1;i<offsetWindow.end.index;i++){
      var segment = item.getSegment(i);
      result.push(segment[1]);
    }
    result.push(offsetWindow.lastSeg[1]);
    return result;
  },

  /**
  extracts sub-polyline frim give item's data line
  @param {Number} offset_start:
  @param {Number} offset_end:
  @param {labelItem} item: item layer_type 1 with data and segdata fill
  @returns {Array}: array of L.Point
  */
  extractSubPolylineByOffsetValues:function(offset_start,offset_end,item){
    var offsetWindow = this.getOffsetWindowOnPolylineWithBorderSegments(offset_start, offset_end, item);
    return this.extractSubPolylineByOffsetWindow(offsetWindow);
  },

  /**
  Used for calculationg overlaps for text along path (textPath SVG).
  @param {Number} start_offset: global offset for this polyline (item), same as used in rendering
  @param {Number} end_offset: global offset for this polyline (item), same as used in rendering
  @param {LabelItem} item:
  @returns {Array} : a poly bounding with height of item.txSize.y
  */
  computeLineBoundaryPolygon:function(start_offset,end_offset,item){
    var offsetWindow = geomEssentials.getOffsetWindowOnPolylineWithBorderSegments(start_offset,end_offset,item);
    var lower_boundary = geomEssentials.extractSubPolylineByOffsetWindow(offsetWindow,item);
    var upper_boundary=geomEssentials.translateByNormal(offsetWindow.firstSeg,item.txSize).slice(0,1); //[a,b]
    if(offsetWindow.lastSeg){
      for(var i=offsetWindow.start.index+1;i<offsetWindow.end.index;i++){
        var curSegment=geomEssentials.translateByNormal(item.getSegment(i,true),item.txSize.y); //only segpoints
        upper_boundary.push(curSegment[1]);
      }
      upper_boundary.push(geomEssentials.translateByNormal(offsetWindow.lastSeg,item.txSize.y)[1]); //[a,b]);
    }
    Array.prototype.push.apply(lower_boundary, upper_boundary.reverse());
    for(var m in lower_boundary)if(isNaN(lower_boundary[m].x)){
      console.log('NAN!');
    }
    return lower_boundary;
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

  createPoly:function(width,height){
    //TODO[createPoly]
  }

}

module.exports = geomEssentials;
