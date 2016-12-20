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

  'holding': {
    length: 1   // this is kinda arbitrary for an object; length varies
  },

};


/**
 * Constructor for Register object
 *
 * @param {object} options the attributes of the register
 * @param {number} options.addr the address of the register (required)
 * @param {string} options.type the type of register: holding, input, object
 * @param {boolean} options.dirty whether the value has been changed but not saved
 * @param {number} options.length 
 * @param {function} options.fnFormat a custom formatting function( buffer, offset )
 * @param {function} options.fnUnformat a custom unformatting function( buffer, offset )
 * @param {function} options.fnValidate a custom validating function
 * @param {function} options.fromBuffer
 * @param {function} options.toBuffer
 * @param {string} options.title a friendly name of the register
 * @param {string} options.units indicates how the formatted value is represented
 * @param {number} options.writeAccess
 * @param {number} options.readAccess
 */
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


  // Store the options, using defaults where necessary
  this.addr = options.addr;
  this.type = options.type || 'holding';
  this.isDirty = options.dirty || false;
  this.length = options.length || types[this.type].length;

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
 * Sets the unformatted value of the register
 *
 * Does not perform validation
 *
 * @param value the new value of this register
 */
Register.prototype.setValue = function( value ) {
  
  this.value = value;

};

/**
 * Sets the value of the register from a formatted value
 *
 *
 * @param formatted the new value of this register
 */
Register.prototype.set = function( formatted ) {
  
  //console.log( 'Register::set ' + this.title + ' ', formatted, ' ', this.unformat( formatted ) );
  this.value = this.unformat( formatted );

};


/**
 * Sets the unformatted value of the register
 *
 * Does not perform validation
 *
 * @param value the new value of this register
 */
Register.prototype.toBuffer = function() {
  
  if( this.value instanceof Buffer ) {
    return this.value;
  }
  else {
    switch( typeof( this.value )) {
      case 'string':
      case 'number':
        return new Buffer( this.value );

      default:
        console.log( this.title + ' value type ' + typeof( this.value ));
        throw new Error( 'Register.toBuffer unknown type. You probably need a custom toBuffer function' );
    }
  
  }

};

/**
 * Returns the value of this register, formatted if possible
 *
 * @return value
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

      case 'buffer':
        return buffer;

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
    return this.fnUnformat( formatted, buffer, addr );

  }
  else {
        throw new Error( 'Tried to unformat unknown Register type' );
  }

};

/**
 * Validates a formatted value
 *
 * @return {boolean} true if the value is valid
 */
Register.prototype.validate = function( value ) {

  //console.log( 'Validating ' + value + ' : ' + this.min + ' : ' + this.max );
  
  if( this.fnValidate ) {
    return this.fnValidate( value );
  }
  else {
    return true;
  }

};


module.exports = Register;