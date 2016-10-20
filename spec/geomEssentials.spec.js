describe("geomEssentials", function() {
    var geomEssentials = require('../src/geomEssentials.js');

    /*var L ={
      point:function(x,y){
        var res={
          x:x,
          y:y,
          divideBy:function(d){
            return L.point(x/d, y/d);
          },
          multiplyBy:function(m){
            return this.divideBy(1/m);
          },
          distanceTo:function(){
            return geomEssentials.get2dVectorLength(this);
          },
          add:function(p){
            return new L.point(this.x+p.x,this.y+p.y);
          }
        }
        return res;
      }
    };*/

    var a=L.point(0,1),
        b=L.point(1,1),
        c=L.point(1,3),
        d=L.point(3,0.5),
        e=L.point(4,0);


    var checkPoint=function(p1,p2){
      expect(p1.x).toEqual(p2.x);
      expect(p1.y).toEqual(p2.y);
    }

    describe('Slope',function(){
      var res=L.point(2,1);
      it('Should be 2,1',function () {
        var slope = geomEssentials.computeSlope(a,c);
        checkPoint(res,slope);
      })
    });

    describe('TranslateSegment',function(){
      var add=L.point(1,1), b2=L.point(2,2), c2=L.point(2,4);
      it('Should be [(2,2),(2,4)]',function () {
        var seg=geomEssentials.translateSegment(b,c,add);
        checkPoint(seg[0],b2);
        checkPoint(seg[1],c2);
      })
    });

    describe('computeSegmentsLengths',function(){
      var polyline = [a,b,c];
      it('Should be [(2,2),(2,4)]',function () {
        var seg=geomEssentials.translateSegment(b,c,add);
        checkPoint(seg[0],b2);
        checkPoint(seg[1],c2);
      })
    });
});
