(function () {
  "use strict";

  var autoLabeler = require('./autoLabeler.js');

  var __onRemove = L.LayerGroup.prototype.onRemove;
  //
  // var geomEssentials = require("./geomEssentials.js");
  //
  // var poly1 =[[195.28215910639838,47.1410795531992],[231,65],[261,9],[273.7383792229255,15.079680992759897],[297.859236050962,-35.4592571231262],[236.8793791587075,-64.56327973079307],[207.3470977755445,-9.43635448222185],[220.326120454396,-2.946843142796098]];
  //
  // var poly2 =[[407.0824120592751,-65.5164843828588],[302,-82],[291.5910849433034,-86.16356602267865],[270.7932070674736,-34.16887133310413],[287.07399919130665,-27.65655448357095],[398.40421700394324,-10.192990905118151]];
  //
  // var poly3 = geomEssentials.clipPoly(poly1,poly2);
  //
  // console.log(poly3);
  //to include in LabelGroup
  var AutoLabelingSupport = {
      /**
      handle removing layer from the map
      */
    onRemove: function (map) {
      this.disableAutoLabel();
        __onRemove.call(this, map);
    },


    /**
     enable autolabeling for this layerGroup, additionally set the current_map variable if it is undefined and hooks label painting on moveend /zoomend events
     it adds this layerGroup to the _layers2label array, so _doAutoLabel function will know about this layerGroup
     @param {Object} options: labelStyle - css string to describe labels look, for now one for all layers in group, propertyName - a property from layer.feature.properties which we label on map
    */
    enableAutoLabel:function(options){
      if(!this._map)return;
      if(!this._map.autoLabeler)return;
      this._al_options = options || {};
      this._al_options.labelStyle = options.labelStyle || "fill: lime; stroke: #000000;  font-size: 20px;"; //TODO [enableAutoLabel] add ability to set unique style for each feature
      this._al_options.propertyName = options.propertyName || "name";
      this._al_options.priority = options.priority || 0; //highest
      this._al_options.zoomToStartLabel = options.zoomToStartLabel || this._map.autoLabeler.options.zoomToStartLabel;
      this._map.autoLabeler.addLayer(this);
    },

    /**
    Obtain autlabelling state for this layerGroup
    @returns {Boolean}
    */
    autoLabelEnabled:function(){
      if(!this._map.autoLabeler)return false;
      return this._map.autoLabeler.hasLayer(this);
    },

    /**
    disable autolabelling
    */
    disableAutoLabel:function(){
      if(!this._map.autoLabeler){
        delete this._al_options;
        return;
      }
      if(this._map.autoLabeler.remLayer(this)){
        delete this._al_options;
      }
    }
  }

  L.LayerGroup.include(AutoLabelingSupport);

  L.Map.addInitHook(function () {
          this.whenReady(function () {
              if (this.options.autolabel) {
                this.autoLabeler = L.autoLabeler(this,this.options.autolabelOptions)
              }
          });
      });

})();
