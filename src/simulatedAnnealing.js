'use strict';

var geomEssentials = require("./geomEssentials.js");
var candidateGenerator = require("./CandidateGenerator.js");

var simulatedAnnealing = {

  /**
  computes the random set of positions for text placement with angles and text values
  @param {Array} all_items: an array with {t,segs} elements, according to t -text of the polyline, segs - its accepted segments to label on. Result array is generated from items of this array
  @returns {Array} : an array with elements such as return values of computeLabelCandidate function
  */
  getInitialRandomState:function(all_items){
    var res=[];
    for(var i=0;i<all_items.length;i++){
      var candidate = candidateGenerator.computeLabelCandidate(i,all_items);
      res.push(candidate);
    }
    return res;
  },

  /**
  Divides all_items into clusters (or builds a graph), such as:
  cluster consists of items with potential label intersections, which are computed by intersecting each item's boundaries (itemPoly)
  Also: if free-of-intersections part of item's poly is capable for containing item's label, then such item is moved to separate cluster
  with only this item -> no further computation for this item at all
  After finishing clustering -> we applying simulatedAnnealing to each cluster independently, and thus, potentially, we
  decrease degree of a problem.
  @param {Array} all_items:
  @returns {Array}: two-dim array if clusters first level, indices of items secodn level.
  */
  computeClusters:function(all_items){
    var cluster_graph=[],overlap_matrix=[];
    //no need to intersect i,j items and j,i items
    for(var i in all_items)
      for(var j in all_items)if(i>j){
        if(overlap_matrix.length<i+1)overlap_matrix.push([i]); //so we have values stub for i item. first ielement with i-index indicates that item isn't moved to cluster yet
        var curClip=geomEssentials.clipPoly(all_items[i].getItemPoly(),all_items[j].getItemPoly());
        if(curClip.length>0){
          overlap_matrix[i].push(j); //so we know now i,j overlaps
          //on each intersection compute free space for this item
          if(!all_items[i].free_space)all_items[i].free_space = curClip;
          else all_items[i].free_space = geomEssentials.subtractPoly(all_items[i].free_space,curClip);
        }
      }
    //now make clustering
    //TODO [computeClusters] check if free space for  each item can fit inside item's labelItem, if so -> create separate cluster for this item, and mark it's index us used (-1)
    //TODO [computeClusters] separate items into clusters
    for(var i in overlap_matrix){
      var cluster = [];
      for(var j=1;j<overlap_matrix[i].length;j++){ //skip first, 'cause ut is marker'
        var curInd = overlap_matrix[i,j];
        if(overlap_matrix[i,0]!==-1 && overlap_matrix[curInd,0]!==-1){ //to be sure not to double data
          cluster.push(curInd);
          overlap_matrix[curInd,0]=-1;
          overlap_matrix[i,0]=-1;
        }
      }
      if(cluster.length>0)cluster_graph.push(cluster);
    }

    return cluster_graph;
  },
  /**
  may be a custom function, must add result as last value of input array
  @param {Array} overlapping_values: input array of areas
  */
  assignCostFunctionValuesToLastEl:function(overlapping_values){
    var res=0;
    for(var i in overlapping_values){
      res+=overlapping_values[i];
    }
    overlapping_values.push(res);
  },

  /**
  summarizing ovelapping of all layers. We store for each label it's total overlapping area with others, the sum values for all labels
  @param {Array}:curset:
  @returns {Array}: values of areas, last is sum
  @memberof MapAutoLabelSupport#
  */
  evaluateCurSet:function(curset){
    var overlap_values=[];
    for(var i in curset){
      for(var j in curset){
        if(i>j){ //to exclude variants like compare (1,3) and then (3,1)
        var curlabel_value=geomEssentials.checkOverLappingArea(curset[i].poly(),curset[j].poly(),this.options.minimizeTotalOverlappingArea);
        //for each pair(i,j) push it's value into overlap_values array
        //we know that we iterate through only lower triangle of matrix (i,j), so we can reconstruct i and j from overlap_values index and vice versa
        //we do it to improve speed when recomputing ovelaps in each annealing iteration in order not to compute all overlaps (with high performance cost)
        //istead we recompute areas only for changed label
        overlap_values.push(curlabel_value);
        }
      }
    }
    this.assignCostFunctionValuesToLastEl(overlap_values);
    return overlap_values;
  },

  markOveralppedLabels:function(curset,overlappedvalues){
    var counter=0;
    for(var i in curset){
      for(var j in curset){
        if(i>j){
          if(overlappedvalues[counter]>0){
            curset[i].overlaps = true;
            curset[j].overlaps = true;
            // this.dodebug(curset[i].t.content_node.textContent +' /// '+curset[j].t.content_node.textContent  )
          }
          counter++;
        }
      }
    }
  },

  getOverlappingLabelsIndexes:function(curvalues,curset){
    var counter=0, result=[];
    for(var i in curset)
     for(var j in curset)if(i>j){
       if(curvalues[counter]>0){
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
  swapCandidateInLabelSetToNew:function(idx,curset,all_items){
    var label_index = curset[idx].all_items_index();
    var new_candidate = candidateGenerator.computeLabelCandidate(label_index,all_items);
    curset[idx]=new_candidate;
  },

  applyNewPositionsForLabelsInArray:function(idx_array,curset,all_items){
    for(var i in idx_array)this.swapCandidateInLabelSetToNew(idx_array[i],curset,all_items);
  },

  /**
  calculates total overlapping area with knowlesge of previous value and what label was moved, affects curvalues
  @param {Array} curvalue: array of float computed at previous step or initital step, consist of elements of lower-triangluar matrix (i,j) of values of overlapping areas for (i,j) els of curset
  @param {Array} curset: current set of label with positions
  @param {Number} changedLabelIndex: an index of label which position we changed
  */
  evaluateAfterSeveralChanged:function(curvalues,curset,changedLabels) {
    var counter=0; //index to iterate through curvalue array
    while(changedLabels.length>0){
      var changedLabelIndex=changedLabels.pop();
      for(var i=0;i<curset.length;i++){
        for(var j=0;j<curset.length;j++){if(i>j){ //i,j like we used them in the evaluateCurSet function, so we get similar counter values
          if(i===changedLabelIndex||j===changedLabelIndex){ //here we obtain all indexes of curvales array corresponding to changedLabelIndex
            var area=this.checkOverLappingArea(curset[i].poly(),curset[j].poly(),this.options.minimizeTotalOverlappingArea); //and recalculate areas
            curvalues[counter]=area;
            }
            counter++;
          }
        }
      }
    }
    curvalues.pop(); //remove prev sum
    this.assignCostFunctionValuesToLastEl(curvalues);
  },

  dodebug:function(message){
    if(this.options.debug)console.log(message);
  },

  processOptions:function(options){
    this.options=options || {};
    this.options.t0 = this.options.t0 || 2.5;
    this.options.decrease_value = this.options.decrease_value || 0.9; //decrease by ten percent each decrease step
    this.options.tmin = this.options.tmin || 0.0;
    this.options.constant_temp_repositionings = this.options.constant_temp_repositionings || 10;
    this.options.max_improvments_count = this.options.max_improvments_count || 10;
    this.options.max_noimprove_count = this.options.max_noimprove_count || 20;
    this.options.maxsteps = this.options.maxsteps || 100;
    this.options.maxtotaliterations = this.options.maxtotaliterations || 100000;
    this.options.minimizeTotalOverlappingArea=this.options.minimizeTotalOverlappingArea || false;
    this.options.debug=this.options.debug || true;
    this.options.allowBothSidesOfLine=this.options.allowBothSidesOfLine || true;
    candidateGenerator.options.lineDiscreteStepPx = this.options.lineDiscreteStepPx || candidateGenerator.options.lineDiscreteStepPx; //pixels
  },

  /**
  @param {Array} items: an arr with labels and their available line segments to place
  @returns {Array}: first is computed label placement array, 2nd is overlapping graph for this array, third is number of iterations.
  */
  _doAnnealing:function(items){
    //init
    var curset=this.getInitialRandomState(items), //current label postions
        curvalues = this.evaluateCurSet(curset), //current overlaping matrix (conflict graph)
        t=this.options.t0, stepcount=0, doexit=curvalues[curvalues.length-1] === 0,//if no overlaping at init state, do nothing and return current state
        iterations=0, This=this;

    var doReturn = function(){
          This.markOveralppedLabels(curset,curvalues);
          return [curset,curvalues,iterations];
        }

    while(true){
     if(t<=this.options.tmin || stepcount>=this.options.maxsteps){
        doReturn();
        return;
      }
      stepcount++;
      var improvements_count=0, no_improve_count=0;
      for(var i=0;i<this.options.constant_temp_repositionings*curset.length;i++){ //while constant temperature, do some replacments
        var oldvalues = curvalues.slice(0), //clone curvalues in order to return to ld ones
            oldset = curset.slice(0),
            overlapped_indexes = this.getOverlappingLabelsIndexes(curvalues,curset);
        this.applyNewPositionsForLabelsInArray(overlapped_indexes,curset,all_items);
        this.evaluateAfterSeveralChanged(curvalues,curset,overlapped_indexes);
        iterations++;
        if(curvalues[curvalues.length-1] === 0){ //no overlaps already
          // This.dodebug('strict solution');
          return doReturn();
        }
        if(iterations>this.options.maxtotaliterations){ //not to hang too long
          return doReturn();
        }
        var delta = (oldvalues[oldvalues.length-1]-curvalues[curvalues.length-1]);
        if(delta<0){//ie, new labeling is worse!
          var P=1 - Math.exp(delta/t);
          if(P>Math.random()){ //undo label reposition with probability of P
            curvalues = oldvalues;
            curset=oldset;
            no_improve_count++;
          }else { //approve new repositioning
            improvements_count++;
            no_improve_count=0;
          }
        }else{
           improvements_count++;
           no_improve_count=0;
         }
        if(no_improve_count>=this.options.max_noimprove_count*curset.length){ //it is already optimal
            return doReturn();
        }
        if(improvements_count>=this.options.max_improvments_count*curset.length){
          break; //of for
        }
      }
      //decrease t
      t*=this.options.decrease_value;
    };
  },

  /**
  find optimal label placement based on simulated annealing approach, relies on paper https://www.eecs.harvard.edu/shieber/Biblio/Papers/jc.label.pdf
  @param {Array} all_items: an arr with labels and their available line segments to place
  @param {Object} options: TODO [simulatedAnnealing] add options description
  @param {Object} callback: a function to gather results and use them to render
  @param {Object} context: a parent conext of the function  above (arguments.callee - but deprecated)
  */
  perform:function(all_items,options,callback,context) {
        if(all_items.length<1){callback([])} //do nothing if no segments
        else{
          var t0 = performance.now();
          this.processOptions(options);
          var clusterGraph=this.computeClusters(all_items),
              total_overlaps=0,total_labels=0,total_iterations=0,totalSet=[];
          for(var i in clusterGraph){
            var curComp=this._doAnnealing(clusterGraph[i]);
            total_overlaps+=curComp[1].pop();
            total_labels+=curComp[0].length;
            total_iterations+=curComp[2];
            Array.prototype.push.apply(totalSet, curComp[0]);
          }
          This.dodebug('overlapping labels count = '+total_overlaps+', total labels count = '+total_labels+', iterations = '+iterations);
          This.dodebug('time to annealing = '+(performance.now()-t0));
          This.markOveralppedLabels(curset,curvalues);
          callback.call(context,curset);
          }
      }
  }


module.exports = simulatedAnnealing;
