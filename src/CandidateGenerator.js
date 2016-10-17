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
  computes label candidate object to place on map
  @param {Number} i: an index in all_items array to obtain label candidate for i-item
  @returns {candidatePosition} : generated candidate
  */
  computeLabelCandidate:function(i,all_items) {
    var candidate;
    switch (all_items[i].layer_type()) {
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
