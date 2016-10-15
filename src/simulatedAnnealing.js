'use strict';

var geomEssentials = require("./geomEssentials.js");
var candidateGenerator = require("./CandidateGenerator.js");

var simulatedAnnealing = {

  /**
  computes the random set of positions for text placement with angles and text values
  @param {Array} allsegs: an array with {t,segs} elements, according to t -text of the polyline, segs - its accepted segments to label on. Result array is generated from items of this array
  @returns {Array} : an array with elements such as return values of computeLabelCandidate function
  */
  getInitialRandomState:function(allsegs){
    var res=[];
    for(var i in allsegs){
      var candidate = candidateGenerator.computeLabelCandidate(i,allsegs);
      res.push(candidate);
    }
    return res;
  },

  /**
  check if two labels overlab, if no returns false, if yes returns ???area OR polygon??? of averlap
  @param {} poly1:a first polygon to check overlap with second
  @param {} poly2:a second polygon to check overlap with first
  @returns {float}: an area of overlapping, zero if no overlapping
  */
  checkOverLappingArea:function(poly1,poly2,calculateAreaNotOnlyFactOfOverlapping) {
    var clipped = geomEssentials.clipPoly(poly1,poly2);
    if(calculateAreaNotOnlyFactOfOverlapping){
      var area =geomEssentials.polyArea(clipped);
      return area;
    };
    if(clipped.length>0)return 1;else return 0; //for performance, skip area calculation
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
        var curlabel_value=this.checkOverLappingArea(curset[i].poly,curset[j].poly,this.options.minimizeTotalOverlappingArea);
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
            this.dodebug(curset[i].t.content_node.textContent +' /// '+curset[j].t.content_node.textContent  )
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
  @param {Number} index : index of label in allsegs to select new random position from availavle choices.
  @param {Array} curset: currently selected label postions
  @param {Array} allsegs: all available postions
  @memberof MapAutoLabelSupport#
  */
  swapCandidateInLabelSetToNew:function(idx,curset,allsegs){
    var label_index = curset[idx].allsegs_index;
    var new_candidate = candidateGenerator.computeLabelCandidate(label_index,allsegs);
    curset[idx]=new_candidate;
  },

  applyNewPositionsForLabelsInArray:function(idx_array,curset,allsegs){
    for(var i in idx_array)this.swapCandidateInLabelSetToNew(idx_array[i],curset,allsegs);
  },

  /**
  calculates total overlapping area with knowlesge of previous value and what label was moved
  @param {Array} curvalue: array of float computed at previous step or initital step, consist of elements of lower-triangluar matrix (i,j) of values of overlapping areas for (i,j) els of curset
  @param {Array} curset: current set of label with positions
  @param {Number} changedLabelIndex: an index of label which position we changed
  @returns {Array} : curvalues, recalculated
  @memberof MapAutoLabelSupport#
  */
  evaluateAfterSeveralChanged:function(curvalues,curset,changedLabels) {
    var counter=0; //index to iterate through curvalue array
    while(changedLabels.length>0){
      var changedLabelIndex=changedLabels.pop();
      for(var i=0;i<curset.length;i++){
        for(var j=0;j<curset.length;j++){if(i>j){ //i,j like we used them in the evaluateCurSet function, so we get similar counter values
          if(i===changedLabelIndex||j===changedLabelIndex){ //here we obtain all indexes of curvales array corresponding to changedLabelIndex
            var area=this.checkOverLappingArea(curset[i].poly,curset[j].poly,this.options.minimizeTotalOverlappingArea); //and recalculate areas
            curvalues[counter]=area;
            }
            counter++;
          }
        }
      }
    }
    curvalues.pop(); //remove prev sum
    this.assignCostFunctionValuesToLastEl(curvalues);
    return curvalues;
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
    candidateGenerator.options=candidateGenerator.options || {};
    candidateGenerator.options.lineDiscreteStepPx = candidateGenerator.options.lineDiscreteStepPx || 1; //pixels
  },

  /**
  find optimal label placement based on simulated annealing approach, relies on paper https://www.eecs.harvard.edu/shieber/Biblio/Papers/jc.label.pdf
  @param {Array} allsegs: an arr with labels and their available line segments to place
  @param {Object} options: TODO [simulatedAnnealing] add options description
  @param {Object} callback: a function to gather results and use them to render
  @param {Object} context: a parent conext of the function  above (arguments.callee - but deprecated)
  */
  perform:function(allsegs,options,callback,context) {
        if(allsegs.length<1){callback([])} //do nothing if no segments
        else{
          var t0 = performance.now();
          this.processOptions(options);
          //init
          var curset=this.getInitialRandomState(allsegs), //current label postions
           curvalues = this.evaluateCurSet(curset), //current overlaping matrix (conflict graph)
           t=this.options.t0, stepcount=0, doexit=curvalues[curvalues.length-1] === 0,//if no overlaping at init state, do nothing and return curretn state
           iterations=0, This=this;

          var doReturn = function(dorender){
            This.dodebug('-----');
            if(dorender){
              This.dodebug('overlapping labels count = '+curvalues.pop()+', total labels count = '+curset.length+', iterations = '+iterations);
              This.dodebug('time to annealing = '+(performance.now()-t0));
              This.markOveralppedLabels(curset,curvalues);
              callback.call(context,curset);
            }else{
              This.dodebug('Map state has been changed. Terminated.');
            }
          }

          //step
          while(true){
            var dorender=true;
             //let know map which timer we are using
            //while constant temperature, do some replacments:
            //  while(t>options.tmin && stepcount<options.maxsteps && !doexit
            if(t<=this.options.tmin || stepcount>=this.options.maxsteps){
              doReturn(dorender);
              return;
            }
            stepcount++;
            var improvements_count=0, no_improve_count=0;
            for(var i=0;i<this.options.constant_temp_repositionings*curset.length;i++){
              var oldvalues = curvalues.slice(0); //clone curvalues in order to return to ld ones
              var oldset = curset.slice(0);
              //now replace randomly all positions, not a sim ann actually
              //TODO [simulatedAnnealing] do actual sim ann - move only overlapping now labels to new random position, for example
              var overlapped_indexes = this.getOverlappingLabelsIndexes(curvalues,curset);
              this.applyNewPositionsForLabelsInArray(overlapped_indexes,curset,allsegs);
              // this.evaluateAfterSeveralChanged(curvalues,curset,overlapped_indexes);
              curvalues=this.evaluateCurSet(curset);
              iterations++;
              if(curvalues[curvalues.length-1] === 0){ //no overlaps already
                This.dodebug('strict solution');
                doReturn(dorender);
                return;
              }
              if(iterations>this.options.maxtotaliterations){ //not to hang too long
                doReturn(dorender);
                return;
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
                This.dodebug('stable state, finish on it');
                doReturn(dorender);
                return;
              }
              if(improvements_count>=this.options.max_improvments_count*curset.length){
                //immediately exit cycle and decrease current t
                doReturn(dorender);
                return;
              }
            }
            //decrease t
            t*=this.options.decrease_value;
          };
      }
  }
}

module.exports = simulatedAnnealing;
