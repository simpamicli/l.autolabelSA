var candidateGenerator = require("./CandidateGenerator.js");
var geomEssentials = require("./geomEssentials.js");

var autoLabelManager = function(all_items){
  var result = {
    items:all_items,
    curset:[],
    curvalues:[],
    conflictMatrix:[],
    _oldvalues:[],
    _oldset:[],
    hasAnywayOverlaps:false,
    overlap_count:function(){
      return (this.curvalues.length>0)?this.curvalues[this.curvalues.length-1]:0;
    },

    isDegenerate:function(){
      return this.items.length ==0;
    },

    saveOld:function(){
      this._oldvalues = this.curvalues.slice(0);
      this._oldset = this.curset.slice(0);
    },

    restoreOld:function(){
      this.curvalues = this._oldvalues;
      this.curset = this._oldset;
    },

    old_overlap_count:function(){
      return (this._oldvalues.length>0)?this._oldvalues[this._oldvalues.length-1]:0;
    },
    /**
    computes the random set of positions for text placement with angles and text values
    @param {Array} all_items: an array with {t,segs} elements, according to t -text of the polyline, segs - its accepted segments to label on. Result array is generated from items of aMan array
    @returns {Array} : an array with elements such as return values of computeLabelCandidate function
    */
    getInitialRandomState:function(){
      this.compConflictMatrix();
      this.curset=[];
      for(var i=0;i<this.items.length;i++){
        var candidate = candidateGenerator.computeLabelCandidate(i,this.items);
        this.curset.push(candidate);
      }
    },

    _testPossibleFitting:function(ind1,ind2){
      //TODO
      return true;
    },

    /**
    Divides all_items into clusters (or builds a graph), such as:
    cluster consists of items with potential label intersections, which are computed by intersecting each item's boundaries (itemPoly)
    Also: if free-of-intersections part of item's poly is capable for containing item's label, then such item is moved to separate cluster
    with only aMan item -> no further computation for aMan item at all
    After finishing clustering -> we applying simulatedAnnealing to each cluster independently, and thus, potentially, we
    decrease degree of a problem.
    @param {Array} all_items:
    @returns {Array}: two-dim array if clusters first level, indices of items secodn level.
    */
    compConflictMatrix:function(){
      this.conflictMatrix=[];
      //no need to intersect i,j items and j,i items
      //TODO mark items which overlaps anyway
      for(var i in this.items){
        for(var j in this.items)if(i>j){
          var curClip=geomEssentials.clipPoly(this.items[i].getItemPoly(),this.items[j].getItemPoly());
          if(curClip.length>0 && this._testPossibleFitting(i,j)){
            this.conflictMatrix.push([i,j,0,false]);//i,j,overlapCount for this pair, if overlaps anyway
            this.curvalues.push(0);
          }
        }
      }
    },

    markOveralppedLabels:function(includeAnywayOverlaps){
        for(var i in this.conflictMatrix){
          if(this.curvalues[i]>0 || (includeAnywayOverlaps && this.conflictMatrix[i][3])){
            var ij = this.conflictMatrix[i];
            this.curset[ij[0]].overlaps = true;
            this.curset[ij[1]].overlaps = true;
          }
        }
    },

    countOverlappedLabels:function(includeAnywayOverlaps){
      var result=0;
      this.markOveralppedLabels(includeAnywayOverlaps);
      for(var i in this.curset)if(this.curset[i].overlaps){
        result++;
      }
      return result;
    },

    /**
    swaps position for a random label with another from this label's positions pool
    @param {Number} index : index of label in all_items to select new random position from availavle choices.
    @param {Array} curset: currently selected label postions
    @param {Array} all_items: all available postions
    @memberof MapAutoLabelSupport#
    */
    swapCandidateInLabelSetToNew:function(idx){
      var label_index = this.curset[idx].all_items_index();
      var new_candidate = candidateGenerator.computeLabelCandidate(label_index,this.items);
      this.curset[idx]=new_candidate;
    },

    applyNewPosToOverlappedLabels:function(){
      this.markOveralppedLabels();
      for(var i in this.curset){
        if(this.curset[i].overlaps){
          this.swapCandidateInLabelSetToNew(i);
          this.curset[i].overlaps=false;
        }
      }
    }
  };
  return result;
}

module.exports = autoLabelManager;
