'use strict';

module.exports = {



 /**
  * @private
  * @param {Array.<number>} byteArray
  * @param {number} bitCount
  * @returns {Array.<boolean>}
  */
  bytesToBits : function(byteArray, bitCount) {
    var bitArray = [];
    var byteCount = byteArray.length;

    for (var byteIndex = 0; byteIndex < byteCount; ++byteIndex)
    {
      var byteValue = byteArray[byteIndex];

      for (var bitIndex = 0; bitIndex < 8; ++bitIndex)
      {
        if (bitArray.length === bitCount)
        {
          break;
        }

        bitArray.push(Boolean(byteValue & Math.pow(2, bitIndex)));
      }
    }

    return bitArray;
  },


  wordToFlags: function( word, map ) {

    var flags = {};

    var bit = 1;

    for( var i = 0; i < map.length; i++ ) {

      flags[ map[i] ] = ( word & bit ) > 0;

      bit <<= 1;
    }

    return flags;
  
  },

  flagsToWord: function( flags, map ) {

    var word = 0;

    map.forEach( function( val, index ) {

      if( flags[val] ){
        word |= ( 1 << index );
      }
    });

    return word;
  
  }


};
