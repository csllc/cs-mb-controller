/**
 * Test the next gen brain memory map
 * 
 */

'use strict';



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

    expect( map.config.throttle.deadband.unformat( 0 )).to.deep.equal( new Buffer( [0,0 ]));
    expect( map.config.throttle.deadband.unformat( 100 )).to.deep.equal( new Buffer( [0,255 ]));

    done();


  });

});

