'use strict';

var geomEssentials = require("./geomEssentials.js");
var autoLabelManager =require("./autoLabelManager.js");
var candidateGenerator =require("./CandidateGenerator.js");

var simulatedAnnealing =function(autoLabelMan,options) {
  var result = {
  aManager:autoLabelMan,

  _overlapPair:function(i,j){

  },

  /**
  summarizing ovelapping of all layers. We store for each label it's total overlapping area with others, the sum values for all labels
  @param {Array}:curset:
  @returns {Array}: values of areas, last is sum
  @memberof MapAutoLabelSupport#
  */
  evaluateCurSet:function(){
    for(var i in this.aManager.conflictMatrix){
      var ij = this.aManager.conflictMatrix[i];
      if(ij[2]>this.options.maxOverlapsForPair){
        this.aManager.curvalues[i]=0;
        ij[3]=true;
        this.aManager.hasAnywayOverlaps=true;
        continue;
      }
      var curlabel_value = geomEssentials.checkOverLappingArea(this.aManager.curset[ij[0]].poly(),this.aManager.curset[ij[1]].poly(),false);
      if(curlabel_value>0){
        ij[2]++;
        this.aManager.curvalues[i] = curlabel_value;
      }else this.aManager.curvalues[i]=0;
    }
    this.aManager.curvalues.push(this.aManager.countOverlappedLabels());
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
    this.options.maxtotaliterations = this.options.maxtotaliterations || 1000;
    this.options.minimizeTotalOverlappingArea=this.options.minimizeTotalOverlappingArea || false;
    this.options.debug=this.options.debug || true;
    this.options.allowBothSidesOfLine=this.options.allowBothSidesOfLine || true;
    this.options.maxOverlapsForPair = this.options.maxOverlapsForPair || 50;
  },

  _doReturn:function(iterations){
    this.aManager.iterations=iterations;
  },

  /**
  @param {Array} items: an arr with labels and their available line segments to place
  @returns {Array}: first is computed label placement array, 2nd is overlapping graph for this array, third is number of iterations.
  */
  _doAnnealing:function(){
    //init
    this.aManager.getInitialRandomState(); //current label postions
    this.evaluateCurSet(); //current overlaping matrix (conflict graph)
    var t=this.options.t0, stepcount=0, doexit=this.aManager.overlap_count()=== 0,//if no overlaping at init state, do nothing and return current state
        iterations=0;
    while(true){
      if(t<=this.options.tmin || stepcount>=this.options.maxsteps) return this._doReturn(iterations);
      stepcount++;
      var improvements_count=0, no_improve_count=0;
      for(var i=0;i<this.options.constant_temp_repositionings*this.aManager.curset.length;i++){ //while constant temperature, do some replacments
        this.aManager.saveOld();
        this.aManager.applyNewPosToOverlappedLabels();
        // this.evaluateAfterSeveralChanged(overlapped_indexes);
        this.evaluateCurSet();
        iterations++;
        if(this.aManager.overlap_count() === 0){
          return this._doReturn(iterations); }
        if(iterations>this.options.maxtotaliterations){
           return this._doReturn(iterations); }
        var delta = (this.aManager.old_overlap_count() - this.aManager.overlap_count());
        if(delta<0){//ie, new labeling is worse!
          var P=1 - Math.exp(delta/t);
          if(P>Math.random()){ //undo label reposition with probability of P
            this.aManager.restoreOld();
            no_improve_count++;
          }else { //approve new repositioning
            improvements_count++;
            no_improve_count=0;
          }
        }else{
           improvements_count++;
           no_improve_count=0;
         }
        if(no_improve_count>=this.options.max_noimprove_count*this.aManager.curset.length){ //it is already optimal
            return this._doReturn(iterations);
        }
        if(improvements_count>=this.options.max_improvments_count*this.aManager.curset.length){
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
  perform:function(callback,context) {
        if(this.aManager.isDegenerate()){callback([])} //do nothing if no segments
        else{
          var t0 = performance.now();
          this._doAnnealing();
          this.dodebug('overlapping labels count = '+this.aManager.countOverlappedLabels(true)+
                       ', total labels count = '+this.aManager.curset.length+', iterations = '+this.aManager.iterations);
          this.dodebug('time to annealing = '+(performance.now()-t0));
          if(this.aManager.hasAnywayOverlaps)this.dodebug('some labels are likely to overlap anyway here.')
          callback.call(context,this.aManager.curset);
          }
      }
    }
    result.processOptions(options);
    return result;
  }


module.exports = simulatedAnnealing;
