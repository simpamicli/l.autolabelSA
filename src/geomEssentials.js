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
  },

  createPoly:function(width,height){
    //TODO[createPoly]
  }

}

module.exports = geomEssentials;
