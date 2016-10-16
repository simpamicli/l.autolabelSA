var geomEssentials = require('./geomEssentials.js');
var itemFactory = require('./LabelItem.js');

var candidateGenerator = {
  options:{
    lineDiscreteStepPx:3
  },

  obtainCandidateForPoint(point){
    //TODO[obtainCandidateForPoint]
  },

  obtainCandidateForPoly(polygon){
    //TODO[obtainCandidateForPoly]
  },

  /**
  Get a poly (simple with no text along path)for random offset on the polyline
  @param {Object} item: item from prepareCurSegments's allsegs
  @returns {Array} : a poly bounding text, placed on corresponding point for offset on poluline and rotated to match segment's skew
  */
  obtainCandidateForPolyLineByRandomStartOffset:function(item){
    var random_offset = item.totalLength*Math.random();
    var candidate = itemFactory.candidatePosition(random_offset,item);
    return candidate;
  },

  /**
  Used for calculationg overlaps for text along path (textPath SVG).
  @param {Number} start_offset: global offset for this polyline (item), same as used in rendering
  @param {Object} item: item from prepareCurSegments's allsegs
  @returns {Array} : a poly bounding curved text
  TODO [computeComplexPolyForLine] rewrite for new notation
  */
  computeComplexPolyForLine:function(start_offset,item){
    var final_offset = start_offset + item.txSize.w;
    var end_offset=(final_offset<=item.totalLength)?final_offset:item.totalLength;
    var sub_polyline = geomEssentials.extractSubPolyline(start_offset,end_offset,item,true); // as segments array

    for(var i in sub_polyline){
      segment = sub_polyline[i];
    }

    //TODO when label is longer than available polyline - no need to, beacuse text is trimmed, maybe show a warning?


  },

  computeComplexPolyForLineoldfunction(start_offset,item){
    var idxNdistStart = this._getSegmentIdxAndDistByOffset(start_offset,item);
    var labelLength = item.t.poly[2][0], labelHeight = Math.abs(item.t.poly[1][1]),
        segStart = item.segs[idxNdistStart.index],
        labelSpaceOnFirstSegment = (idxNdistStart.dist - start_offset);

    //TODO [computeComplexPolyForLine] check left-to-right text orientation on final polygone!


    //in the next lines we construct upper boundary of total polygone - lower is polyline actually =)
    //now fill above lines
    var above_line = [getAboveLine(segStart,segStart.seglen -  labelSpaceOnFirstSegment,labelLength,labelHeight)];
    var above_lines = [above_line.line];
    var finishOnLineBelow = above_line.line[1];
    var remaining_length = labelLength-above_line.minusLen;
    //if we have more than 1 segment to cover:
    if(labelSpaceOnFirstSegment < labelLength && idxNdistStart.index<(item.segs.length-1)){
      var idxNdisEnd = this._getSegmentIdxAndDistByOffset(start_offset+labelLength,item);
      for(var i=idxNdistStart.index+1;i<=idxNdisEnd.index;i++)if(remaining_length>0){
        var temp_line = [getAboveLine(item.segs[i],0,remaining_length,labelHeight)];
        above_lines.push(temp_line.line);
        remaining_length-=temp_line.minusLen;
        finishOnLineBelow=temp_line.line[1];
      }
    }

    //if we have some unsused length
    //TODO [computeComplexPolyForLine] check if it is draw actually, so no add to polyline part (below)
    if(remaining_length>0){
      var last_segment_expanded = geomEssentials.expandSegment(above_lines.pop(),remaining_length);
      above_lines.push(last_segment_expanded);
    }

    var TINY = 1; //beacouse 1px is tiny on screen
    var poly=[geomEssentials.interpolateOnPointSegment(segStart.seg[0],segStart.seg[1],(segStart.seglen -  labelSpaceOnFirstSegment)/segStart.seglen)]; // a result! init with first point on polyline
    poly.push(above_lines[0][0]);
    //expand / slice lines to have a continius boundary above
    for(var j=1;j< above_lines.length;j++){
      var endOfPrev = above_lines[j-1][1];
      var startOfThis =  above_lines[j][0];
      if(startOfThis.distanceTo(endOfPrev)>TINY){
        //add middle line
      }else{
        poly.push(endOfPrev);
      }
    }

    //push last vertex of above;
    poly.push(above_lines[j][1]);

    //now add polyline pts, in reverse order
    poly.push(finishOnLineBelow);
    if(idxNdisEnd){ //more than 1 seg
      for(var k=idxNdisEnd.index;k>idxNdistStart.index;k--){
        poly.push(item.segs[k].seg[0]);
      }
    }
    //now compute poly from below and above boundary

    return poly; //starting with insertion point on the line
  },
  /**
  computes label candidate object to place on map
  @param {Number} i: an index in all_items array to obtain label candidate for i-item
  @returns {candidatePosition} : generated candidate
  */
  computeLabelCandidate:function(i,all_items) {
    var candidate;
    switch (all_items[i].layertype) {
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
