'use strict';

var geomEssentials = require("./geomEssentials.js");
var annealingManager =require("./annealingManager.js");

var simulatedAnnealing = {

  aMan:"not assigned",

  /**
  summarizing ovelapping of all layers. We store for each label it's total overlapping area with others, the sum values for all labels
  @param {Array}:curset:
  @returns {Array}: values of areas, last is sum
  @memberof MapAutoLabelSupport#
  */
  evaluateCurSet:function(aMan){
    aMan.curvalues=[];
    for(var i in aMan.curset){
      for(var j in aMan.curset){
        if(i>j){ //to exclude variants like compare (1,3) and then (3,1)
        var curlabel_value=(conflictMatrix[i+j]>0)?geomEssentials.checkOverLappingArea(aMan.curset[i].poly(),aMan.curset[j].poly(),false):0;
        curvalues.push(curlabel_value);
        }
      }
    }
    this.assignCostFunctionValuesToLastEl(aMan.curvalues);
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
  calculates total overlapping area with knowlesge of previous value and what label was moved, affects curvalues
  @param {Array} curvalue: array of float computed at previous step or initital step, consist of elements of lower-triangluar matrix (i,j) of values of overlapping areas for (i,j) els of curset
  @param {Array} curset: current set of label with positions
  @param {Number} changedLabelIndex: an index of label which position we changed
  */
  evaluateAfterSeveralChanged:function(aMan,changedLabels) {
    var counter=0; //index to iterate through curvalue array
    while(changedLabels.length>0){
      var changedLabelIndex=changedLabels.pop();
      for(var i=0;i<aMan.curset.length;i++){
        for(var j=0;j<aMan.curset.length;j++){if(i>j){ //i,j like we used them in the evaluateCurSet function, so we get similar counter values
          if(i===changedLabelIndex||j===changedLabelIndex){ //here we obtain all indexes of curvales array corresponding to changedLabelIndex
            var area=this.checkOverLappingArea(aMan.curset[i].poly(),aMan.curset[j].poly(),this.options.minimizeTotalOverlappingArea); //and recalculate areas
            aMan.curvalues[counter]=area;
            }
            counter++;
          }
        }
      }
    }
    aMan.curvalues.pop(); //remove prev sum
    this.assignCostFunctionValuesToLastEl(aMan.curvalues);
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
    var annManager = new annealingManager(items);
        annManager.getInitialRandomState(); //current label postions
        this.evaluateCurSet(annManager); //current overlaping matrix (conflict graph)
    var t=this.options.t0, stepcount=0, doexit=annManager.overlap_count()=== 0,//if no overlaping at init state, do nothing and return current state
        iterations=0;

    var doReturn = function(){
          annManager.markOveralppedLabels();
          annManager.iterations=iterations;
          return annManager;
        }

    while(true){
     if(t<=this.options.tmin || stepcount>=this.options.maxsteps){
        return doReturn();
      }
      stepcount++;
      var improvements_count=0, no_improve_count=0;
      for(var i=0;i<this.options.constant_temp_repositionings*curset.length;i++){ //while constant temperature, do some replacments
        annManager.saveOld();
        var overlapped_indexes = annManager.getOverlappingLabelsIndexes();
        annManager.applyNewPositionsForLabelsInArray(overlapped_indexes);
        this.evaluateAfterSeveralChanged(annManager,overlapped_indexes);
        iterations++;
        if(aMan.overlap_count() === 0){ return doReturn(); }
        if(iterations>this.options.maxtotaliterations){ return doReturn(); }
        var delta = (annManager.old_overlap_count() - annManager.overlap_count());
        if(delta<0){//ie, new labeling is worse!
          var P=1 - Math.exp(delta/t);
          if(P>Math.random()){ //undo label reposition with probability of P
            annManager.restoreOld();
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
      t*=this.options.decrease_value; //decrease temp
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
          var annRes = this._doAnnealing(all_item);
          this.dodebug('overlapping labels count = '+annRes.overlap_count()+', total labels count = '+annRes.curset.length+', iterations = '+annRes.iterations);
          this.dodebug('time to annealing = '+(performance.now()-t0));
          callback.call(context,annRes.curset);
          }
      }
  }


//module.exports = simulatedAnnealing;
