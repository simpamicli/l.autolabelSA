var featureGenerator = {
  generateWord:function(minLength,maxLength){
    var result = "";
    for(var i=minLength;i<=maxLength;i++){
      result+="A";
    }
    return result;
  },
  generatePoints:function(numPoints,maxWordLength){

  },
  generateLines:function(numLines,minSegCount,maxSegCount,minSegLenght,maxSegLength,maxWordLength){

  },
  generatePolys:function(numLines,minSegCount,maxSegCount,minSegLenght,maxSegLength,maxWordLength){

  }
}

module.exports = featureGenerator;
