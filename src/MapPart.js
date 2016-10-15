(function () {
  "use strict";

  var autoLabeler = require('./autoLabeler.js');

  var __onRemove = L.LayerGroup.prototype.onRemove;
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
