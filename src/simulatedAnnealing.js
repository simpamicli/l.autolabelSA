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
  get a random element from segments array of the item, assuming it is sorted lengths ascending order
  probability is higher for longer segment
  */
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

    if(!point_and_angle){
      this.dodebug('error is here');
    }
    if(point_and_angle.angle)poly=geomEssentials.rotatePoly(poly,[0,0],point_and_angle.angle); //rotate if we need this
    poly=geomEssentials.movePolyByAdding(poly,[point_and_angle.p2add.x,point_and_angle.p2add.y]);
    return {t:t,poly:poly,pos:point_and_angle.p2add,a:point_and_angle.angle,allsegs_index:i};;
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
    this.options.lineDiscreteStepPx = this.options.lineDiscreteStepPx || 1; //pixels
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
          var t=this.options.t0;
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
              curset=this.getInitialRandomState(allsegs); //current label postions
              curvalues = this.evaluateCurSet(curset); //current overlaping matrix
              iterations++;
              if(curvalues[curvalues.length-1] === 0){
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
