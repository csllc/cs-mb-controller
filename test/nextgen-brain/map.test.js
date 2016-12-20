/**
 * Test the next gen brain memory map
 * 
 */

'use strict';

var buffers = require('h5.buffers');

var expect = require('chai').expect;

// Include the memory map for product identification
var Map = require('../../lib/map/cs8100_default');

var map = new Map();

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


describe('Throttle', function() {

  it('decode deadband settings', function(done) {

    expect( map.config.throttle.deadband.format( new Buffer([0,0] ) )).to.equal(0);
    expect( map.config.throttle.deadband.format( new Buffer([0,255]))).to.equal(100);

    var buf = new Buffer(2);

    //expect( map.config.throttle.deadband.unformat( 0, buf )).to.equal( new Buffer( [0,0 ]));

    //expect( map.config.throttle.deadband.unformat( 0 )).to.deep.equal( new Buffer( [0,0 ]));
    //expect( map.config.throttle.deadband.unformat( 100 )).to.deep.equal( new Buffer( [0,255 ]));

    done();


  });
});

describe('Status Characteristic', function() {

  it('decode status', function(done) {

    // this is what comes in from BLE
    var ble = new Buffer( [ 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,0x09, 0x0A, 
                            0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14  ] );

    var status = map.decodeStatusBuffer( ble );

    console.log( status );

    expect( status.portB.key).to.equal(true);

    done();


  });
});

