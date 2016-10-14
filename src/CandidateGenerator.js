var geomEssentials = require('./geomEssentials.js');

var candidateGenerator = {
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
      var discrete_seg_len = ((seglen-labelLength) / this.options.lineDiscreteStepPx);
      var random_pos =(Math.floor(Math.random()*discrete_seg_len)*this.options.lineDiscreteStepPx);//index of selected part of segemnt to place label
      var ratio = random_pos / seglen;
      p2add = geomEssentials.interpolateOnPointSegment(segStartPt,segEndPt,ratio); //get actual insertion point for label
    }
    var angle = geomEssentials.computeAngle(segStartPt,segEndPt); //get its rotation around lower-left corner of BBox
    return {p2add:p2add,angle:angle};
  },

  obtainCandidateForPoint(point){
    //TODO[obtainCandidateForPoint]
  },

  obtainCandidateForPoly(polygon){
    //TODO[obtainCandidateForPoly]
  },

  /**
  based on https://blog.dotzero.ru/weighted-random-simple/
  get a random element from segments array of the item, assuming it is sorted lengths ascending order
  probability is higher for longer segment
  */
  getIndexBasedOnTotalLengthRandom:function(item){
    var random_pos = Math.random()*item.total_length; //get a position random for all segments of this polyline visible on the screen
    //obtain and index of segment, to which belongs this position, it is assumed tha segments are sorted by length
    var clen=0;
    for(var i=0;i<item.segs.length;i++){
      clen+=item.segs[i].seglen;
      if(clen>random_pos)break;
    }
    return i;
  },

  /**
  computes label candidate object to place on map
  @param {Number} i: an index in allsegs array to obtain label for candidate and segments array wuth segments to choose
  @returns {Object} : an object with {t,poly,pos,a,allsegs_index} elements, such as t - text to label,poly - bounding rect of label, pos - pos to place label, a - angle to rotate label,allsegs_index - index in segments array
  */
  computeLabelCandidate:function(i,allsegs) {
    var t = allsegs[i].t; //label part
    var segs = allsegs[i].segs;

    //choose the segment index from parts visible on screeen
    //here we should prioritize segments with bigger length
    //assuming segs array is sorted ascending using segment length
    var idx =this.getIndexBasedOnTotalLengthRandom(allsegs[i]);
    //var idx = Math.floor(Math.random()*segs.length);
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

    if(!point_and_angle){
      this.dodebug('error is here');
    }
    if(point_and_angle.angle)poly=geomEssentials.rotatePoly(poly,[0,0],point_and_angle.angle); //rotate if we need this
    poly=geomEssentials.movePolyByAdding(poly,[point_and_angle.p2add.x,point_and_angle.p2add.y]);
    return {t:t,poly:poly,pos:point_and_angle.p2add,a:point_and_angle.angle,allsegs_index:i};;
  },
}

module.exports = candidateGenerator;
