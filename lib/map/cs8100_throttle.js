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

var Register = require('../Register');

var buffers = require('h5.buffers');

var helpers = require('./helpers');


var throttleFlagBits = 
[
  'frontDriveIn',           // BIT 00 set for front drive mode in indoor mode
  'throttleLimitedBoost',   // BIT 01 set for boost limited by throt position
  'accelLimitedBoost',      // BIT 02 set for boost limited by accel
  'mcalFromStposh',         // BIT 03 set for mcal taken from st_posh
  'feedback',               // BIT 04 set when feedback present for going straight fwd
  'softDecel',              // BIT 05 set for no neg boost
  'frontDriveOut',          // BIT 06 set for front drive mode in outdoor mode
  'noEmBrake',              // BIT 07 set for no embrake
  'throttleInvert',         // BIT 08 invert polarity of throttle when set
  'throttleInvert2',        // BIT 09 invert polarity of throttle 2 when set  
  'aninThrottle',           // BIT 10 set for anin used for max speed
  'aninThrottle2',          // BIT 11 set for anin used for max steer
  'maxSpeedThrottle',       // BIT 12 set for maxspd used for max speed
  'maxSpeedThrottle2',      // BIT 13 set for maxspd used for max steer
  'ultapotThrottle',        // BIT 14 set for ultapot used for max speed
  'ultapotThrottle2'        // BIT 15  set for ultapot used for max steer
];


/**
 * Decode the throttle flags into a 16-bit word
 */
 /*
function wordToFlags( word ){

  return {
    frontDriveIn:   (word & 0x0001) > 0,    // set for front drive mode in indoor mode
    throttleLimitedBoost:    (word & 0x0002) > 0,    // set for boost limited by throt position
    accelLimitedBoost:    (word & 0x0004) > 0,    // set for boost limited by accel
    mcalFromStposh: (word & 0x0008) > 0,        // set for mcal taken from st_posh
    feedback: (word & 0x0010) > 0,           // set when feedback present for going straight fwd
    softDecel: (word & 0x0020) > 0,        // set for no neg boost
    frontDriveOut: (word & 0x0040) > 0,     // set for front drive mode in outdoor mode
    noEmBrake: (word & 0x0080) > 0,        // set for no embrake
    throttleInvert: (word & 0x0100) > 0,        // invert polarity of throttle when set
    throttleInvert2: (word & 0x0200) > 0,       // invert polarity of throttle 2 when set    
    aninThrottle: (word & 0x0400) > 0,        // set for anin used for max speed
    aninThrottle2: (word & 0x0800) > 0,       // set for anin used for max steer
    maxSpeedThrottle: (word & 0x1000) > 0,      // set for maxspd used for max speed
    maxSpeedThrottle2: (word & 0x2000) > 0,     // set for maxspd used for max steer
    ultapotThrottle: (word & 0x4000) > 0,     // set for ultapot used for max speed
    ultapotThrottle2: (word & 0x8000) > 0,    // set for ultapot used for max steer
  };
}



  // throttle failband
  // 1B  fl_band     ;throttle failband value, default s/b 3.2V
  // 1C  fl_band2    ; = high byte of hex[(desired V - 2.5)/5*4096*16*2]
  //                 ; For unidirection throttle,
  //                 ; = high byte of hex[(desired V)/5*4096*16]
  this.failband = new Register({
    title: 'Failband',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint16LE',
    units: '%',
    min: 0,
    max: 100,

    // Convert raw value into user-friendly version
    format: function( buffer, addr ) {
      return buffer.readUInt16LE( addr );
    },

    // Convert user friendly value into raw value and store in buffer
    unformat: function( value, buffer, addr ) {
        
      // validate the value
      this.validate( value );

      // value is a percentage; scale to word
      var word = value * 655.35;

      // save to the buffer
      buffer.writeUInt16LE( word, addr );
    },

  });
  

  // Throttle Scale
  // 1D   thrtscl    ;throttle scaling value, determines where full speed ;occurs
  // 1E   thrt2scl   ; For bidi throt = 0xff/[(desired V - deadband ;V)/5*4096*16*2]
  //                 ; For unidirection throttle,
  //                 ; = 0xff/[(desired V - deadband V)/5*4096*16]

  this.thrtscl = new Register({
    title: 'Throttle Scale',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint16LE',
    units: '%',
    min: 0,
    max: 100,

  });

  // Throttle flags
  // 1F   tht_flgs   ;throttle flags.  See bit definitions below:
  //         tht_invert      tht_flgs,0      ;invert polarity of throttle ;when set
  //         tht2_invert     tht_flgs,1      ;invert polarity of throttle 2 ;when set
  //         anin_throt      tht_flgs,2      ;set for anin used for max ;speed
  //         anin_throt2     tht_flgs,3      ;set for anin used for max ;steer
  //         maxspd_throt    tht_flgs,4      ;set for maxspd used for max ;speed
  //         maxspd_throt2   tht_flgs,5      ;set for maxspd used for max ;steer
  //         ultapot_throt   tht_flgs,6      ;set for ultapot used for max ;speed
  //         ultapot_throt2  tht_flgs,7      ;set for ultapot used for max ;steer
  this.thrtFlags = new Register({
    title: 'Throttle Flags',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint8',

    // Convert raw value into user-friendly version
    format: function( buffer, addr ) {

      var value = buffer.readUInt8( addr );

      return {
        invert: (value & 0x01) > 0,
        anin: (value & 0x04) > 0,
        maxSpeed: (value & 0x10) > 0,
      };
    },

    // Convert user friendly value into raw value and store in buffer
    unformat: function( value, buffer, addr ) {

      // validate the value
      this.validate( value );

      var byte = 0;

      if( value.invert ) {
        byte |= 0x01;
      }
      if( value.anin ) {
        byte |= 0x04;
      }
      if( value.maxSpeed ) {
        byte |= 0x10;
      }

      // save to the buffer
      buffer.writeUInt8( byte, addr );
    },

  });


  // Throttle settings
  // Combination of throttle-related registers
  this.throttle = new Register({
    title: 'Throttle',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    eeAddr: 0x19,
    length: 7,
    format: function( buffer, addr ) {
      return {
        deadband: map.deadband.format( buffer, addr ),
        failband: map.failband.format( buffer, addr ),
        scale: map.thrtscl.format( buffer, addr ),
        flags: map.thrtFlags.format( buffer, addr )

      };
    },
  });

  this.uThrottle = new Register({
    title: 'UThrottle',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    eeAddr: 0x57,

    format: function( buffer, addr ) {

      var value = buffer.readUInt8( addr );

      return {
        serial: (value & 0x01) > 0,
        analog: (value & 0x02) > 0,
        serialTht: (value & 0x04) > 0,
        invertSerial: (value & 0x08) > 0,
      };
    },
  });

*/

module.exports = {

  title: 'Throttle Config',
  writeAccess: Register.UNRESTRICTED,
  readAccess: Register.UNRESTRICTED,

  // Convert raw value into user-friendly version
  format: function( buffer, offset ) {

    return {
      deadband: parseInt( buffer.readUInt16LE( offset ) / 655.35),
      failband: parseInt( buffer.readUInt16LE( offset+2 ) / 655.35),
      scale: parseInt( buffer.readUInt16LE( offset+4 ) / 655.35),
      flags: helpers.wordToFlags( buffer.readUInt16LE( offset+6 ), throttleFlagBits )
      
    }; 
  },

  // Convert user friendly values into raw values in a buffer
  unformat: function( value ) {
      
    // validate the value

    var flags = 0;

    // Initialize a buffer
    var builder = new buffers.BufferBuilder();

    builder
      .pushUInt16( parseInt( value.deadband * 655.35 ))
      .pushUInt16( parseInt( value.failband * 655.35 ))
      .pushUInt16( parseInt( value.scale * 655.35))
      .pushUInt16( helpers.flagsToWord( value.flags, throttleFlagBits ) );
 
    return builder.toBuffer();    

  },

};
