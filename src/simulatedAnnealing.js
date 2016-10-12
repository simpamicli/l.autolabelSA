'use strict';

var geomEssentials = require("./geomEssentials.js");

var simulatedAnnealing = {

  obtainCandidateForPolyLine:function(seg_w_len,labelLength){
    if(!seg_w_len){
      return;
    }
    var seg = seg_w_len.seg, seglen = seg_w_len.seglen;
    var segStartPt = seg[0],segEndPt=seg[1];
    if(segStartPt.x>segEndPt.x){
      var tmp=segStartPt; segStartPt=segEndPt; segEndPt=tmp; //be sure that text is always left-to-right
    }
    var p2add;
    //now we need not let label exceed segment length. If seg is too small, the ratio shoud be zero
    //so, calculate ratio as following:
    if(labelLength>=seglen){
      p2add = segStartPt;
    }else{
      var discrete_seg_len = ((seglen-labelLength) / this.options.lineDiscreteStepPx);
      var random_pos =(Math.floor(Math.random()*discrete_seg_len)*this.options.lineDiscreteStepPx);//index of selected part of segemnt to place label
      var ratio = random_pos / seglen;
      p2add = geomEssentials.interpolateOnPointSegment(segStartPt,segEndPt,ratio); //get actual insertion point for label
    }
    var angle = geomEssentials.computeAngle(segStartPt,segEndPt); //get its rotation around lower-left corner of BBox
    return {p2add:p2add,angle:angle};
  },

  obtainCandidateForPoint(point){
    //TODO[obtainCandidateForPoint]
  },

  obtainCandidateForPoly(ring){
    //TODO[obtainCandidateForPoly]
  },

  /**
  based on https://blog.dotzero.ru/weighted-random-simple/
  get a random element from array, assuming it is sorted ascending order and weights are indexes of elements in the array
  */
  getWeightedRandomIndex( segs )
  {
    var total = segs.length*(segs.length-1)/2; //weight is number in array
    var n = 0;
    var num = Math.floor(Math.random()*total);
    for(var i =0;i< segs.length; i++){
      n+=i;
      if(n>=num)return i;
    }
  },

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
  computes label candidate object to place on map
  TODO [computeLabelCandidate] place label on both sides of segment
  TODO [computeLabelCandidate] check label not to exceed side of the screen, maybe slide along segment
  TODO [computeLabelCandidate] add polygon support: if two or more independent areas of one poly on screen, label both
  @param {Number} i: an index in allsegs array to obtain label for candidate and segments array wuth segments to choose
  @returns {Object} : an object with {t,poly,pos,a,allsegs_index} elements, such as t - text to label,poly - bounding rect of label, pos - pos to place label, a - angle to rotate label,allsegs_index - index in segments array
  */
  computeLabelCandidate:function(i,allsegs) {
    var t = allsegs[i].t; //label part
    var segs = allsegs[i].segs;

    //choose the segment index from parts visible on screeen
    //here we should prioritize segments with bigger length
    //assuming segs array is sorted ascending using segment length
    var idx =this.getIndexBasedOnTotalLengthRandom(allsegs[i]);
    //var idx = Math.floor(Math.random()*segs.length);
    var poly,point_and_angle;
    poly = allsegs[i].t.poly;

    switch (allsegs[i].layertype) {
      case 0:
        break;
      case 1:
        point_and_angle=this.obtainCandidateForPolyLine(segs[idx],t.poly[2][0]);
        break;
      case 2:
        break;
    }

    if(point_and_angle.angle)poly=geomEssentials.rotatePoly(poly,[0,0],point_and_angle.angle); //rotate if we need this
    poly=geomEssentials.movePolyByAdding(poly,[point_and_angle.p2add.x,point_and_angle.p2add.y]);
    return {t:t,poly:poly,pos:point_and_angle.p2add,a:point_and_angle.angle,allsegs_index:i};;
  },

  /**
  clones element of curset
  @param {Number} index:
  @param {Array} curset:
  @returns {Object}:
  */
  copyCandidate:function(index,curset) {
    var cancopy = curset[index];
    cancopy.poly = curset[index].poly.slice(0);
    return cancopy;
  },

  /**
  computes the random set of positions for text placement with angles and text values
  @param {Array} allsegs: an array with {t,segs} elements, according to t -text of the polyline, segs - its accepted segments to label on. Result array is generated from items of this array
  @returns {Array} : an array with elements such as return values of computeLabelCandidate function
  */
  getInitialRandomState:function(allsegs){
    var res=[];
    for(var i in allsegs){
      var candidate = this.computeLabelCandidate(i,allsegs);
      res.push(candidate);
    }
    return res;
  },

  /**
  swaps position for a random label with another from this label's positions pool
  @param {Number} index : index of label in allsegs to select new random position from availavle choices.
  @param {Array} curset: currently selected label postions
  @param {Array} allsegs: all available postions
  */
  swapCandidateInLabelSet:function(idx,curset,allsegs){
    var label_index = curset[idx].allsegs_index;
    var new_candidate = this.computeLabelCandidate(label_index,allsegs);
    curset[idx]=new_candidate;
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

  /**
  calculates total overlapping area with knowlesge of previous value and what label was moved
  @param {Array} curvalue: array of float computed at previous step or initital step, consist of elements of lower-triangluar matrix (i,j) of values of overlapping areas for (i,j) els of curset
  @param {Array} curset: current set of label with positions
  @param {Number} changedLabelIndex: an index of label which position we changed
  @returns {Array} : curvalues, recalculated
  @memberof MapAutoLabelSupport#
  */
  evaluateAfterOneChanged:function(curvalues,curset,changedLabelIndex) {
    var counter=0; //index to iterate through curvalue array
    for(var i in curset){
      for(var j in curset){if(i>j){ //i,j like we used them in the evaluateCurSet function, so we get similar counter values
        if(i===changedLabelIndex||j===changedLabelIndex){ //here we obtain all indexes of curvales array corresponding to changedLabelIndex
          var area=this.checkOverLappingArea(curset[i].poly,curset[j].poly,this.options.minimizeTotalOverlappingArea); //and recalculate areas
          curvalues[counter]=area;
          }
          counter++;
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
    this.options.decrease_value = this.options.decrease_value || 0.8; //decrease by ten percent each decrease step
    this.options.tmin = this.options.tmin || 0.0;
    this.options.constant_temp_repositionings = this.options.constant_temp_repositionings || 20;
    this.options.max_improvments_count = this.options.max_improvments_count || 50;
    this.options.max_noimprove_count = this.options.max_noimprove_count || 50;
    this.options.maxsteps = this.options.maxsteps || 300;
    this.options.maxtotaliterations = this.options.maxtotaliterations || 15000;
    this.options.minimizeTotalOverlappingArea=this.options.minimizeTotalOverlappingArea || false;
    this.options.checkDistanceFromCenter=this.options.checkDistanceFromCenter || false;
    this.options.mapCenter=this.options.mapCenter || [0,0];
    this.options.debug=this.options.debug || true;
    this.options.allowBothSidesOfLine=this.options.allowBothSidesOfLine || true; //TODO [processOptions]
    this.options.lineDiscreteStepPx = this.options.lineDiscreteStepPx || 10; //pixels
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
          var curset=this.getInitialRandomState(allsegs); //current label postions
          var curvalues = this.evaluateCurSet(curset); //current overlaping matrix
          var t=options.t0;
          var stepcount=0;
          var doexit=curvalues[curvalues.length-1] === 0;//if no overlaping at init state, do nothing and return curretn state
          var iterations=0;
          var This=this;
          var oldCenter = context._map.getCenter(), oldZoom = context._map.getZoom();

          var doReturn = function(dorender){
            This.dodebug('-----');
            if(dorender){
              This.dodebug('overlapping labels count = '+curvalues.pop()+', total labels count = '+curset.length+', iterations = '+iterations);
              var t1 = performance.now();
              This.dodebug('time to annealing = '+(t1-t0));
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
            if(t<=options.tmin || stepcount>=options.maxsteps)return;
            stepcount++;
            var improvements_count=0, no_improve_count=0;
            for(var i=0;i<options.constant_temp_repositionings*curset.length;i++){
              var oldvalues = curvalues.slice(0), //clone curvalues in order to return to ld ones
                  random_label_ind = Math.floor((Math.random() * curset.length) ), //randomly choose one label
                  old_pos = This.copyCandidate(random_label_ind,curset);
              This.swapCandidateInLabelSet(random_label_ind,curset,allsegs); //change label position
              This.evaluateAfterOneChanged(curvalues,curset,random_label_ind); //calc new sum
              iterations++;
              if(curvalues[curvalues.length-1] === 0){
                This.dodebug('strict solution');
                doReturn(dorender);
                return;
              }
              var delta = (oldvalues[oldvalues.length-1]-curvalues[curvalues.length-1]);
              if(delta<0){//ie, new labeling is worse!
                var P=1 - Math.exp(delta/t);
                if(P>Math.random()){ //undo label reposition with probability of P
                  curvalues = oldvalues;
                  curset[random_label_ind]=old_pos;
                  no_improve_count++;
                }else { //approve new repositioning
                  improvements_count++;
                  no_improve_count=0;
                }
              }else{
                 improvements_count++;
                 no_improve_count=0;
               }
              if(no_improve_count>=options.max_noimprove_count*curset.length){ //it is already optimal
                This.dodebug('stable state, finish on it');
                doReturn(dorender);
                return;
              }
              if(improvements_count>=options.max_improvments_count*curset.length){
                //immediately exit cycle and decrease current t
                doReturn(dorender);
                return;
              }
            }
            //decrease t
            t*=options.decrease_value;
            if(iterations>this.options.maxtotaliterations){ //not to hang too long
              doReturn(dorender);
              return;
            }
          };
      }
  }
}

module.exports = simulatedAnnealing;
