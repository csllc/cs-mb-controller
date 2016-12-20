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

}


// Inherit basic map properties  Note, the inherits
// call needs to be before .prototype. additions for some reason
util.inherits( NextGenDefaultMap, RegisterMap );


module.exports = NextGenDefaultMap;

  