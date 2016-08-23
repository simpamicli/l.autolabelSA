# l.autolabelSA

Auto-label plugin for leaflet

##Usage

Include l.autolabelSA in your proj

Set then map.enableAutoLabel(true,options) for your map(s). Or use map.toggleAutoLabelling() with default options

  options : TODO



Set layergroup.enableAutoLabel(true,options) for each layergroup you want to label.

  options : **propertyName** - which property from layer.feature.properties use for labels, default is "name"

  options : **labelStyle** - css string to describe label's style for this

  TODO: other options


###Now runs ONLY with polylines

tested with leaflet 1rc1
