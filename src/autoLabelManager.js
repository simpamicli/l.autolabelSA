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
      for(var i in this.items){
        for(var j in this.items)if(i>j){
          var curClip=geomEssentials.clipPoly(this.items[i].getItemPoly(),this.items[j].getItemPoly());
          /*if(curClip.length>0){
            //on each intersection compute free space for this item
            if(!this.items[i].free_space)this.items[i].free_space = curClip;
            else this.items[i].free_space = geomEssentials.subtractPoly(this.items[i].free_space,curClip);
          }*/
          this.conflictMatrix.push(curClip.length); //if zero -> no need to check overlappings for i,j with index i+j.
        }
      }
    },

    markOveralppedLabels:function(){
      var counter=0;
      for(var i in this.curset){
        for(var j in this.curset){
          if(i>j){
            if(this.curvalues[counter]>0){
              this.curset[i].overlaps = true;
              this.curset[j].overlaps = true;
            }
            counter++;
          }
        }
      }
    },

    getOverlappingLabelsIndexes:function(){
      var counter=0, result=[];
      for(var i in this.curset)
        for(var j in this.curset)
          if(i>j){
            if(this.curvalues[counter]>0){
           result.push(i); result.push(j);
         }
         counter++;
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

    applyNewPositionsForLabelsInArray:function(idx_array){
      for(var i in idx_array)this.swapCandidateInLabelSetToNew(idx_array[i]);
    }
  };
  return result;
}

module.exports = autoLabelManager;
