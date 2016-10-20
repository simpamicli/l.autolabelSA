describe("geomEssentials", function() {
    var geomEssentials = require('../src/geomEssentials.js');

    var L ={
      point:function(x,y){
        var res={
          x:x,
          y:y,
          divideBy:function(d){
            return new L.point(x/d, y/d);
          },
          multiplyBy:function(m){
            return this.divideBy(1/m);
          },
          distanceTo:function(){
            return geomEssentials.get2dVectorLength(this);
          }
        }
      }
    };

    var a=L.point(0,0),
        b=L.point(1,1),
        c=L.point(2,1),
        d=L.point(3,0.5),
        e=L.point(3,0),
        polyline= [a,b,c,d,e];

    describe('Round point',function(){
      it('Should be 1,2',function () {
        expect(geomEssentials.roundPoint(p)).toEqual(res);
      })
    });
});