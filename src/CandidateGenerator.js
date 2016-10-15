var geomEssentials = require('./geomEssentials.js');

var candidateGenerator = {
  options:{
    lineDiscreteStepPx:3
  },

  _aquireCandidateDataLine:function(segobj,position_on_seg){
    var seg = segobj.seg;
    var segStartPt = seg[0],segEndPt=seg[1];
    if(segStartPt.x>segEndPt.x){
      var tmp=segStartPt; segStartPt=segEndPt; segEndPt=tmp; //be sure that text is always left-to-right
    }
    var ratio = position_on_seg / segobj.seglen;
    var p2add = geomEssentials.interpolateOnPointSegment(segStartPt,segEndPt,ratio); //get actual insertion point for label
    return {p2add:p2add,angle:segobj.angle};
  },

  obtainCandidateForPolyLineBySegmentIndex:function(seg_w_len,labelLength){
    if(!seg_w_len){
      return;
    }
    var seg = seg_w_len.seg, seglen = seg_w_len.seglen, pos = 0;
    //now we need not let label exceed segment length. If seg is too small, the ratio shoud be zero
    //so, calculate ratio as following:
    if(labelLength<seglen){
      var discrete_seg_len = ((seglen-labelLength) / this.options.lineDiscreteStepPx);
      pos =(Math.floor(Math.random()*discrete_seg_len)*this.options.lineDiscreteStepPx);//index of selected part of segemnt to place label
    }
    return this._aquireCandidateDataLine(seg_w_len,pos);
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
  Get a segment from polyline part by it's offset
  @param {Number} offset: na offset for the polyline
  @param {Object} item: item from prepareCurSegments's allsegs
  @returns {Object} : index of segment and dist which is offset from start of the line to the end of found segment
  */
  _getSegmentIdxAndDistByOffset:function(offset,item){
    cdist=0;
    for(var i in item.segs){
      cdist+=item.segs[i].seglen;
      if(offset<cdist){
        return {index:i,dist:cdist};
      }
    }
    return {index:i,dist:cdist};
  },

  /**
  Get a poly (simple with no text along path)for random offset on the polyline
  @param {Object} item: item from prepareCurSegments's allsegs
  @returns {Array} : a poly bounding text, placed on corresponding point for offset on poluline and rotated to match segment's skew
  */
  obtainCandidateForPolyLineByRandomStartOffset:function(item){
    var random_offset = item.total_length*Math.random(),
        idxNdist = this._getSegmentIdxAndDistByOffset(random_offset,item),
        seg = item.segs[idxNdist.index],
        pos = seg.seglen - (idxNdist.dist - random_offset);
    return this._aquireCandidateDataLine(seg,pos);
  },

  /**
  Used for calculationg overlaps for text along path (textPath SVG).
  @param {Number} start_offset: global offset for this polyline (item), same as used in rendering
  @param {Object} item: item from prepareCurSegments's allsegs
  @returns {Array} : a poly bounding curved text
  */
  computeComplexPolyForLine:function(start_offset,item){
    var idxNdistStart = this._getSegmentIdxAndDistByOffset(start_offset,item);
    var labelLength = item.t.poly[2][0], labelHeight = -item.t.poly[1][1],
        segStart = item.segs[idxNdistStart.index],
        posStart = segStart.seglen - (idxNdistStart.dist - start_offset);
        poly = this._aquireCandidateDataLine(segStart,posStart);

    if(idxNdistStart.dist - start_offset < labelLength && idxNdistStart.index<(item.segs.length-1)){
      var idxNdisEnd = this._getSegmentIdxAndDistByOffset(start_offset+labelLength,item);
      var remaining_length = labelLength;
      for(var i=idxNdistStart.index+1;i<=idxNdisEnd.index;i++){
        //TODO [computeComplexPolyForLine] construct a new poly by adding
        var temp_poly = geomEssentials.createPoly()
      }
    }
    return poly; //starting with insertion point on the line
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
    //var idx =this.getIndexBasedOnTotalLengthRandom(allsegs[i]);
    var idx = Math.floor(Math.random()*segs.length);
    var poly,point_and_angle;
    poly = allsegs[i].t.poly;

    switch (allsegs[i].layertype) {
      case 0:
        break;
      case 1:
        point_and_angle=this.obtainCandidateForPolyLineByRandomStartOffset(allsegs[i]);
        // point_and_angle=this.obtainCandidateForPolyLineBySegmentIndex(segs[idx],t.poly[2][0]);
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
