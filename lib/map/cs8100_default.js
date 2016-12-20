/**
 * This module exports an object constructor that represents the memory map of a controller.
 *
 * The memory map is built by including various portions of the map
 * Usage:
 *  var map = require('./lib/map/cs8100_default.js')
 *
 *
 */
'use strict';

var util = require('util');

var RegisterMap = require('../RegisterMap');

var Register = require('../Register');

var helpers = require('./helpers');

var buffers = require('h5.buffers');



var throttleConfig = require( './cs8100_throttle');


// Memory bank definitions (match those embedded in the controller)
var BANK_RAM    = 0x0000;
var BANK_HRAM   = 0x0100;
var BANK_EEPROM  = 0x0300;

/*
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

*/




var portBFlagBits = 
[
  'key',         
  'charging',   
  'bit2',     
  'bit3',         
  'bit4',               
  'indoor',              
  'bit6',         
  'bit7'
];

var portCFlagBits = 
[
  'reverse',         
  'bit1',   
  'bit2',     
  'bit3',         
  'bit4',               
  'bit5',      
  'quickstop', 
  'brakeRelease'
];


function convertThrottleToVolts( msb, lsb ) {
  var volts = msb * 256 + lsb;

  return  5.0 * volts / ( 255.0 * 256 );

}

function convertTempToDegrees( msb, lsb ) {
  var temp = msb - 0x6C;

  temp = temp + (lsb / 255 );

  return temp;

}


function convertBatteryToVolts( msb, lsb ) {
  var volts = msb * 256 + lsb;

      volts = volts * 1469.0;
      volts = volts / 3.0;
      volts = volts / 16777216.0;
      volts = volts * 24;
  return volts;
}


function convertCurrentToAmps( msb, lsb ) {

           // Take the 16-bit value
      var current = msb * 256 + lsb;

      // divide by a magic number to get floating point amps
      var amps = (current / 0x69);

      // if the ram value has the lower bit set, negate the current
      if( 0 === current & 0x0001 ) {
        amps = -amps;
      }

      return amps;
  
}

function NextGenDefaultMap() {
  
 
  // base class constructor
  RegisterMap.call( this );

  // keep a reference we can use to access this object
  var map = this;

  // Defines all the configuration items
  this.config = {

    throttle: {
      deadband: new Register( Object.assign( throttleConfig.deadband, { addr: BANK_EEPROM + 0x19 })),
      failband: new Register( Object.assign( throttleConfig.failband, { addr: BANK_EEPROM + 0x1B })),
      scale: new Register( Object.assign( throttleConfig.scale, { addr: BANK_EEPROM + 0x1D })),
      flags: new Register( Object.assign( throttleConfig.flags, { addr: BANK_EEPROM + 0x1F })),
      uflags: new Register( Object.assign( throttleConfig.uflags, { addr: BANK_EEPROM + 0x57 })),
   
    },


  };

  // Defines the RAM versions of the configuration items
  this.ramConfig = {

    throttle: {
      deadband: new Register( Object.assign( throttleConfig.deadband, { addr: BANK_RAM + 0xB9 })),
      failband: new Register( Object.assign( throttleConfig.failband, { addr: BANK_RAM+ 0xBB })),
      scale: new Register( Object.assign( throttleConfig.scale, { addr: BANK_RAM + 0xBD })),
      flags: new Register( Object.assign( throttleConfig.flags, { addr: BANK_RAM + 0xBF })),
      uflags: new Register( Object.assign( throttleConfig.uflags, { addr: BANK_HRAM + 0x97 })),
   
    },

  };

  // Defines the raw register blocks that contain eeprom settings.  These can
  // be used to efficiently read or write blocks of configuration (without
  // individually reading or writing each register)
  this.eeprom = {
    block1: new Register( { type: 'holding', addr: BANK_EEPROM + 0, length: 0x50 } ),
    block2: new Register( { type: 'holding', addr: BANK_EEPROM + 0x50, length: 0x20 } ),
    block3: new Register( { type: 'holding', addr: BANK_EEPROM + 0x80, length: 0x20 } ),
  };


  this.decodeStatusBuffer = function( buffer ) {

    // Create a buffer reader object
    var reader = new buffers.BufferReader( buffer );

    return {
      portB: helpers.wordToFlags( reader.shiftByte(), portBFlagBits ),
      portC: helpers.wordToFlags( reader.shiftByte(), portCFlagBits ),
      pwm: helpers.byteToPercent( reader.shiftByte() ),
      throttle: helpers.byteToPercent( reader.shiftByte() ),
      throttleV: convertThrottleToVolts( reader.shiftByte(), reader.shiftByte() ),
      current: convertCurrentToAmps( reader.shiftByte(), reader.shiftByte() ),
      temperature: convertTempToDegrees( reader.shiftByte(), reader.shiftByte() ),
      batteryVolts: convertBatteryToVolts( reader.shiftByte(), reader.shiftByte() )

    };
  };


  this.targetPortB = new Register( { 
    title: 'Port B',
    type: 'holding', 
    addr: BANK_RAM + 0x06,

    format: function( buffer, offset ) {
      return helpers.wordToFlags( buffer.readUInt16BE( offset ), portBFlagBits );
    },

    unformat: function( value ) {

      var buf = new Buffer(2);

      buf.writeUInt16BE( helpers.flagsToWord( value, portBFlagBits ), 0 );

      return buf;
    },


  });

  this.targetPortC = new Register( { 
    title: 'Port C',
    type: 'holding', 
    addr: BANK_RAM + 0x07,

    format: function( buffer, offset ) {
      return helpers.wordToFlags( buffer.readUInt16BE( offset ), portCFlagBits );
    },

    unformat: function( value ) {

      var buf = new Buffer(2);

      buf.writeUInt16BE( helpers.flagsToWord( value, portCFlagBits ), 0 );

      return buf;
    },


  });

}


// Inherit basic map properties  Note, the inherits
// call needs to be before .prototype. additions for some reason
util.inherits( NextGenDefaultMap, RegisterMap );


module.exports = NextGenDefaultMap;

  