/**
 * Object that represents and manipulates a register
 *
 * This provides a convenient way to describe registers and convert their contents
 * to and from user-friendly interpretations.
 *
 */
'use strict';

var types = {
  'ee': {
    length: 1
  },

  'uint8': {
    length: 1
  },

  'uint16': {
    length: 1
  },

  'uintBE': {
    length: 2
  },

  'uint16LE': {
    length: 2
  },

  'uint32' : {
    length: 2
  },

  'object': {
    length: 1   // this is kinda arbitrary for an object; length varies
  },


};


// Constructor for Item object
function Register( options ) {

  // Define access levels for registers.
  // Unrestricted = anybody can access it
  // OEM/Factory/Engineering = limited to authorized users
  // BLOCKED = nobody can access it.  Not sure if this is useful
  this.UNRESTRICTED = 0;
  this.OEM = 10;
  this.FACTORY = 20;
  this.ENGINEERING = 30;
  this.BLOCKED = 1000;


  // Save the address 
  //this.addr = options.addr;
  this.type = options.type || 'uint16';

  this.isDirty = options.dirty || false;

  this.length = options.length || types[this.type].length;

  this.min = options.min || 0;
  this.max = options.max || 255;


  this.fnFormat = options.format || null;
  this.fnUnformat = options.unformat || null;
  this.fnValidate = options.validate || null;

  this.fromBuffer = options.fromBuffer || this.fromBuffer;
  this.toBuffer = options.toBuffer || this.toBuffer;
  
  this.title = options.title || 'Reg: ' + this.addr;
  
  this.units = options.units || '';
  
  this.writeAccess = options.writeAccess || this.FACTORY;
  this.readAccess = options.readAccess || this.FACTORY;

  this.value = null;

}

/**
 * Returns the value of this item, formatted if possible
 *
 * @return {[type]} value
 */
Register.prototype.setValue = function( value ) {
  
  this.value = value;

};

/**
 * Returns the value of this item, formatted if possible
 *
 * @return {[type]} value
 */
Register.prototype.format = function( buffer, offset ) {

  offset = offset || 0;
  buffer = buffer || this.value;

  if( this.fnFormat ) {
    return this.fnFormat( buffer, offset );
  }
  else {
    switch( this.type ) {
      case 'uint8':
        return buffer.readUInt8( offset );

      case 'uint16LE':
        return buffer.readUInt16LE( offset );

      case 'uint16BE':
        return buffer.readUInt16BE( offset );

      default:
        throw new Error( 'Tried to format unknown Register type' );
    }

    
  }

};


/**
 * Sets the value of the object, from the format()ted version
 *
 * @return {[type]} value
 */
Register.prototype.unformat = function( formatted, buffer, addr ) {

  if( this.fnUnformat ) {
    this.value = this.fnUnformat( formatted, buffer, addr );
  }
  else {

    switch( this.type ) {
      case 'uint8':
        return buffer.writeUInt8( formatted, addr );

      case 'uint16LE':
        return buffer.writeUInt16LE( formatted, addr );

      case 'uint16BE':
        return buffer.writeUInt16BE( formatted, addr );

      default:
        throw new Error( 'Tried to unformat unknown Register type' );
    }
  }

};

/**
 * Sets the value of the object, from the format()ted version
 *
 * @return {[type]} value
 */
Register.prototype.validate = function( value ) {

  //console.log( 'Validating ' + value + ' : ' + this.min + ' : ' + this.max );
  
  if( this.fnValidate ) {
    return this.fnValidate( value );
  }
  else {

    var bValid = true;

    // if there's a min attribute, check it
    bValid = bValid && ( 'undefined' !== this.min && value >= this.min );

    // if a max attribute, check it
    bValid = bValid && ( 'undefined' !== this.max && value <= this.max );

    if( !bValid ) {
      throw new Error( 'Validation Error');
    }

  }

};


/**
 * Returns a boolean array containing the bits in the value
 * @param {number} value the number to convert to bits
 * @param {number} length the number of 8-bit bytes in the value
 */
Register.prototype.uint16ToBoolArray = function( value ) {
  var b = [];

  var bit = 1;

  for( var i = 0; i < 16; i++) {
    b.push( (value & bit)? true : false );
    bit = bit << 1;
  }

  return b;
};

/**
 * Returns a boolean array containing the bits in the value
 * @param {number} value the number to convert to bits
 * @param {number} length the number of 8-bit bytes in the value
 */
Register.prototype.uint8ToBoolArray = function( value ) {
  var b = [];

  var bit = 1;

  for( var i = 0; i < 8; i++) {
    b.push( (value & bit)? true : false );
    bit = bit << 1;
  }

  return b;
};

/**
 * Returns a 8-bit byte formatted as hex string. 2 chars long
 *
 */
Register.prototype.valueToHex8 = function(value) {
  if( 'undefined' === typeof( value ) ) value = this.value;

  return '0x' + this.zeroPad( this.value.toString(16), 2);
};

/**
 * Returns a 16-bit word formatted as hex string, 4 chars long
 *
 */
Register.prototype.valueToHex16 = function(value) {
  if( 'undefined' === typeof( value ) ) value = this.value;

  return '0x' + this.zeroPad( value.toString(16), 4);
};

/**
 * Returns a 32-bit word formatted as hex string, 8 chars long
 *
 */
Register.prototype.valueToHex32 = function(value) {
  if( 'undefined' === typeof( value ) ) value = this.value;

  return '0x' + this.zeroPad( this.value.toString(16), 8);
};

/**
 * Returns a 32-bit word from a string
 *
 */
Register.prototype.hex32ToValue = function( hex ) {

  if( 'string' === typeof( hex )) {
    return parseInt( hex, 16 );
  }
  else {
    return hex;
  }
};

/**
 * Returns a 16-bit word from a string
 *
 */
Register.prototype.hex16ToValue = function( hex ) {

  if( 'string' === typeof( hex )) {
    return parseInt( hex, 16 );
  }
  else {
    return hex;
  }

};


/**
 * Returns a byte formatted as decimal string
 *
 */
Register.prototype.value8 = function() {

    return this.value & 0xFF;
};

/**
 * Returns a 16-bit word formatted as decimal string
 *
 */
Register.prototype.value16 = function() {
    return (this.value & 0xFFFF);
};

/**
 * Zero pads a number (on the left) to a specified length
 *
 * @param  {number} number the number to be padded
 * @param  {number} length number of digits to return
 * @return {string}        zero-padded number
 */
Register.prototype.zeroPad = function( number, length ) {
  var pad = new Array(length + 1).join( '0' );

  return (pad+number).slice(-pad.length);
};

/**
 * Converts a percentage value to an item's scaled value based on its min and max
 *
 * @param item an object from the memory map that has a max and min value
 * @param value the value that should be converted from a percent
 */
Register.prototype.value8FromPercent = function() {
    return Math.max(
      Math.min(
        Math.round((this.value * this.max / 100)-this.min), this.max),this.min);
};

/**
 * Converts a percentage value to an 8-bit byte
 *
 * 100% = 255, 0%=0
 * @param value the value that should be converted from a percent
 */
Register.prototype.byteFromPercent = function( value ) {
    return Math.round( value * 255 / 100, 0 );
};


/**
 * Convert a byte value to an integer percent 
 *
 * 255 = 100%

 * @param value the value that should be converted to a percent
 *
 * @returns {Number}
 */
Register.prototype.byteToPercent = function( value ) {
    return Math.round( value * 100 / 255, 0);
};

/**
 * Convert a value to a percent using the item's max and min parameters
 *
 * @param item an object from the memory map that has a max and min value
 * @param value the value that should be converted to a percent
 *
 * @returns {Number}
 */
Register.prototype.toPercent = function( value ) {
    return Math.max(
      Math.min(
        Math.round((value-this.min) * 100 / this.max), 100),0);
};


module.exports = Register;