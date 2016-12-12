var geomEssentials = require('./geomEssentials.js');
var itemFactory = require('./LabelItem.js');

var candidateGenerator = {
  options:{
    lineDiscreteStepPx:3
  },

  /**
  @param {PointItem} item
  @returns {Array} : a poly bounding text, placed somewhere in point's available domain
  */
  obtainCandidateForPoint:function(item){
    var avOriginsSize = item._availableOrigins.getSize();
    var randomX =item._availableOrigins.min.x + Math.random() * avOriginsSize.x;
    var randomY =item._availableOrigins.min.y + Math.random() * avOriginsSize.y;
    var candidate = itemFactory.candidatePosition(L.point(randomX,randomY - item.txSize.y),item);
    candidate.poly();
    return candidate;
  },

  obtainCandidateForPoly:function(polygon){
    //TODO[obtainCandidateForPoly]
  },

  /**
  Get a poly (simple with no text along path)for random offset on the polyline
  @param {LineItem} item: item from prepareCollectedData's allsegs
  @returns {Array} : a poly bounding text, placed on corresponding point for offset on poluline and rotated to match segment's skew
  */
  obtainCandidateForPolyLineByRandomStartOffset:function(item){
    var random_offset =(item.totalLength - item.txSize.x>0) ?  (item.totalLength - item.txSize.x)*Math.random():0;
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
      case 0:{
          candidate = this.obtainCandidateForPoint(all_items[i]);
          break;
      }
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
