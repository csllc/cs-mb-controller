/**
 * This module exports an object that represents the memory map of a controller.
 *
 * The memory map is built by including various portions of the map
 * Usage:
 *  var map = require('./lib/maps/nextgen_default.js')
 *
 *
 */
'use strict';

var util = require('util');

var RegisterMap = require('../RegisterMap');

var Register = require('../Register');

var throttleConfig = require( './cs8100_throttle');


//var Ident = require('./ident');
//var Calibration = require('./nextgen_cal');

// Memory bank definitions (match those embedded in the controller)
var BANK_RAM0    = 0x0000;
var BANK_RAM1    = 0x0100;
var BANK_RAM2    = 0x0200;
var BANK_EEPROM  = 0x0300;

// Memory bank sizes (in 16-bit words; matches definitions in controller)
var BANK_RAM0_SIZE    = 0x30 / 2;
var BANK_RAM1_SIZE    = 0x50 / 2;
var BANK_RAM2_SIZE    = 0x40 / 2;
var BANK_EEPROM_SIZE  = 0xFF / 2;


// Size of each of the memory banks.  These match constants in the 
// controller code
var BRAIN_RAM0_SIZE  = 0x30;
var BRAIN_RAM1_SIZE  = 0x50;
var BRAIN_RAM2_SIZE  = 0x40;
var BRAIN_EEPROM_SIZE  = 0xFF;


function NextGenDefaultMap() {
  
 
  // base class constructor
  RegisterMap.call( this );

  // keep a reference we can use to access this object
  var map = this;

  // Shadow copies of controller memory space
  // as well as memory to keep track of changed values
  this.ee = new Buffer( 256 );
  this.eeDirty = new Buffer( 256 );
  this.ee.fill(0xFF);
  this.eeDirty.fill( 0 );

  this.hiRam = new Buffer( 256 );
  this.hiDirty = new Buffer( 256 );
  this.hiRam.fill(0xFF);
  this.hiDirty.fill( 0 );

  this.loRam = new Buffer( 256 );
  this.loDirty = new Buffer( 256 );
  this.loRam.fill(0xFF);
  this.loDirty.fill( 0 );

  // ----- Register definitions --------
  
  // Max Speed
  this.maxSpeed = new Register({
    title: 'Max Speed',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint8',
    units: '%',
    min: 0,
    max: 100,

    // Convert raw value into user-friendly version
    format: function( buffer, addr ) {
      return this.byteToPercent( buffer.readUInt8( addr ));
    },

    // Convert user friendly value into raw value and store in buffer
    unformat: function( value, buffer, addr ) {
        
      // validate the value
      this.validate( value );

      // save to the buffer
      buffer[addr] = this.byteFromPercent( value );
    },

  });

  // pointer for last recorded fault in fault log in EEPROM
  this.faultPtr = new Register({
    title: 'Fault Pointer',
    writeAccess: Register.BLOCKED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint8',
  });


  this.config = {

  //  id: id,

 //   calibration: calibrationConfig,

    throttle: new Register( Object.assign( throttleConfig, { addr: BANK_EEPROM + 4, type: 'holding', length: 4 })),


    set: function( register, newValue ) {

      if( register.reg instanceof Register ) {
        register.reg.unformat( newValue, map.ee, register.addr );

        register.isDirty = true;

      }
      else {
        throw new Error( 'register must be of type Register');
      }
    },

    get: function( register ) {

      if( register.reg instanceof Register ) {
        return register.reg.format( map.ee, register.addr );
      }
      else {
        throw new Error( 'register must be of type Register');
      }

    },

    isDirty: function() {

      var bDirty = false;

      for (var prop in this) {
        
        if( this[prop].hasOwnProperty( 'isDirty') && this[prop].isDirty ) {
          
          bDirty = true;
        }
      }

      return bDirty;
    },

    toJSON: function() {

    },

    fromJSON: function() {

    },

    toCsv: function() {

    }

  };

  this.WRITE_COMMAND = 1;
  this.READ_COMMAND = 2;

  /*
  this.ee = new Buffer( BRAIN_EEPROM_SIZE );
  this.ram0 = new Buffer( BRAIN_RAM0_SIZE );
  this.ram1 = new Buffer( BRAIN_RAM1_SIZE );
  this.ram2 = new Buffer( BRAIN_RAM2_SIZE );


  // Hardware state
  // 19 d_band      ;throttle deadband value, default s/b 2.55V
  // 1A d_band2     ; = high byte of hex[(desired V - 2.5)/5*4096*16*2]
  //                ; For unidirectional throttle, ; = high byte of ;hex[(desired V)/5*4096*16]
  this.hwState = new Register({
    title: 'Hardware State',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint16LE',

    // Convert raw value into user-friendly version
    format: function( buffer, addr ) {
      return {
        hwState: buffer[0],
        drivePwm: buffer[1]
      };  
    },

    // Convert user friendly value into raw value and store in buffer
    unformat: function( value, buffer, addr ) {
        
      // validate the value
      this.validate( value );

      // value is a percentage; scale to word
      var word = parseInt(value * 655.35);

      // save to the buffer
      buffer.writeUInt16LE( word, addr );
    },

  });

  this.driveStatus01 = new Register({
    title: 'Drive Status 01',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint16LE',

    // Convert raw value into user-friendly version
    format: function( buffer, addr ) {
      return {
        hwState: buffer[0],
        drivePwm: buffer[1]
      }
    },

    // Convert user friendly value into raw value and store in buffer
    unformat: function( value, buffer, addr ) {
        
      // validate the value
      this.validate( value );

      // value is a percentage; scale to word
      var word = parseInt(value * 655.35);

      // save to the buffer
      buffer.writeUInt16LE( word, addr );
    },

  });

  this.driveStatus23 = new Register({
    title: 'Drive Status 23',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint16LE',

    // Convert raw value into user-friendly version
    format: function( buffer, addr ) {
      return {
        hwState: buffer[0],
        drivePwm: buffer[1]
      };
    },

    // Convert user friendly value into raw value and store in buffer
    unformat: function( value, buffer, addr ) {
        
      // validate the value
      this.validate( value );

      // value is a percentage; scale to word
      var word = parseInt(value * 655.35);

      // save to the buffer
      buffer.writeUInt16LE( word, addr );
    },

  });
*/

}


// Inherit basic map properties  Note, the inherits
// call needs to be before .prototype. additions for some reason
util.inherits( NextGenDefaultMap, RegisterMap );


module.exports = NextGenDefaultMap;

  