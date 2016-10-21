//a class to compute pixel dimensions of texts
/** @namespace DOMEssentials*/
'use strict';
var geomEssentials = require("./geomEssentials.js");

module.exports = {
  /**
  converts TextRectangle object to clockwise array of 2d-arrays, representing rectangular poly
  @param {TextRectangle} rect: a bbox for text
  @returns {Array}
  @memberof DOMEssentials#
  */
  convertClientRectToArrayOfArrays:function(rect) {
    var res=[];
    var height_correction=rect.height*0.2; //beacuse getBoundingClientRect give a bit false height info
    res.push([0,0]);
    res.push([0,-rect.height]);
    res.push([rect.width,-rect.height]);
    res.push([rect.width,0]);
    res=geomEssentials.movePolyByAdding(res,[0,height_correction]);
    return res;
  },

  /**
  returns a bounding box for horizontal text with style as in t.content_node
  @param {Object} map: current map
  @param {Object} node: textNode
  @returns {L.Point} : a bbox for node, as width and height
  @memberof DOMEssentials#
  */
  getBoundingBox:function(map,node){
    var svg = map.options.renderer._container;
    svg.appendChild(node);
    var rect = node.getBoundingClientRect();
    svg.removeChild(node);
    return L.point(rect.width,-rect.height);
  },

  /**
  creates SVG text node with specified style and handles some formatting issues
  @param {String} text: text for node
  @param {String} textstyle: CSS style String
  @returns {TextNode} : SVG node
  */
  createSVGTextNode:function(text,textstyle){
    text = text.replace(/ /g, '\u00A0');  // Non breakable spaces
    var node =L.SVG.create('text');
    node.setAttribute('style',textstyle);
    node.textContent = text;
    return node;
  }
}
