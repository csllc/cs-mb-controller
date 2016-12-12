/**
 * Test script for the map helper library
 *
 * This script checks basic read/non-destructive write tests for the MODBUS
 * functions
 *
 */
'use strict';

// Load the object that handles communication to the device
var helpers = require('../lib/map/helpers');

// Test helpers
var assert = require('chai').assert;
var expect = require('chai').expect;



function countFlags( flags ) {
  
  var set = 0;

  // count number of bits set in flags
  Object.keys( flags ).forEach( function( flag ) {
    if( flags[flag] ) {
      set ++;
    }
  });

  return set;
}


/**
 * Pre-test
 *
 * Runs once, before all tests in this block.
 * Calling the done() callback tells mocha to proceed with tests
 *
 */
before(function( done ) {
  done();
});

after(function( done ) {
  // runs after all tests in this block
  done();
});

beforeEach(function( done ) {
  // runs before each test in this block
  done();
});

afterEach(function( done ) {
  // runs after each test in this block
  done();
});

describe('bytesToBits', function() {

  it('should decode a byte', function(done) {

    var bits;

    bits = helpers.bytesToBits( [0xAA], 8 );
    expect( bits.length ).to.equal( 8 );
    expect( bits[0] ).to.equal( false );
    expect( bits[1] ).to.equal( true );
    expect( bits[7] ).to.equal( true );

    done();

  });

  it('should decode 4 bytes', function(done) {

    var bits;

    bits = helpers.bytesToBits( [0xAA, 0x55, 0x00, 0x01], 32 );
    expect( bits.length ).to.equal( 32 );
    expect( bits[0] ).to.equal( false );
    expect( bits[1] ).to.equal( true );
    expect( bits[7] ).to.equal( true );
    expect( bits[24] ).to.equal( true );
    expect( bits[25] ).to.equal( false );
    expect( bits[26] ).to.equal( false );
    expect( bits[27] ).to.equal( false );
    expect( bits[28] ).to.equal( false );
    expect( bits[29] ).to.equal( false );
    expect( bits[30] ).to.equal( false );
    expect( bits[31] ).to.equal( false );

    done();

  });

});


describe('wordToFlags', function() {

  var flagMap = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z'
  ];

  it('should decode zero', function(done) {

    var flags = helpers.wordToFlags( 0x0000, flagMap );

    expect( Object.keys( flags ).length).to.equal( 26 );

    expect( countFlags( flags ) ).to.equal( 0 );

    done();

  });

 it('should decode all 1s', function(done) {

    var flags = helpers.wordToFlags( 0xFFFFFFFF, flagMap );

    expect( Object.keys( flags ).length).to.equal( 26 );

    expect( countFlags( flags ) ).to.equal( 26 );

    done();

  });

 it('should decode 1 flag', function(done) {

    var flags = helpers.wordToFlags( 0x1, flagMap );

    expect( Object.keys( flags ).length).to.equal( 26 );

    expect( countFlags( flags ) ).to.equal( 1 );

    expect( flags.a ).to.equal( true );

    done();

  });


});


describe('flagsToWord', function() {

  var flagMap = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z'
  ];

  it('should decode one flag', function(done) {

    var flags = { f: true };

    var word = helpers.flagsToWord( flags, flagMap );

    expect( word ).to.equal( 0x20 );

    done();

  });

  it('should decode empty object', function(done) {

    var word = helpers.flagsToWord( {}, flagMap );

    expect( word ).to.equal( 0x0 );

    done();
  });

  it('should decode all flags', function(done) {

    var flags = { 
      a: true, b: true, c: true, d: true, e: true, f: true, g: true, h: true,
      i: true, j: true, k: true, l: true, m: true, n: true, o: true, p: true,
      q: true, r: true, s: true, t: true, u: true, v: true, w: true, x: true,
      y: true, z: true

    };

    var word = helpers.flagsToWord( flags, flagMap );

    expect( word ).to.equal( 0x3FFFFFF );

    flags.b = false;

    word = helpers.flagsToWord( flags, flagMap );

    expect( word ).to.equal( 0x3FFFFFD );

    done();

  });


});


