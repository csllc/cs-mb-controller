/**
 * Object that represents basic register map operations
 *
 * This object is probably never instantiated itself; rather it
 * is used as a 'base class' from which register maps are extended
 *
 * Copyright (c) 2017 Control Solutions LLC.  All Rights Reserved
 */
'use strict';

var Register = require('./Register');


function RegisterMap() {
 

}


/**
 * Recursively find registers in a register map object
 * 
 * @param  {[type]} mapItem [description]
 * @param {function} wrapFunc Function to wrap the register before it is appended to the list
 * @return {array}  array containing wrapped Register objects
 */
RegisterMap.prototype.buildList = function( mapItem, wrapFunc ) {

  var result = [];

  if( mapItem instanceof Register ) {

    if( 'function' === typeof(wrapFunc) ) {
      result.push( wrapFunc(mapItem));
    }
    else {
      result.push( mapItem );

    }

  }
  else if( 'object' === typeof( mapItem )) {

    for (var prop in mapItem) {
      if( mapItem.hasOwnProperty( prop ) ) {
        result = result.concat( this.buildList( mapItem[ prop ], wrapFunc ));
      }
    }

  }

  return result;
};

RegisterMap.prototype.newbuildList = function( mapItem, wrapFunc ) {

  var result = [];

  if( mapItem instanceof Register ) {

    if( 'function' === typeof(wrapFunc) ) {
      result.push( wrapFunc(mapItem));
    }
    else {
      result.push( mapItem );

    }

    // recurse any subregisters
    for (var prop in mapItem.sub ) {

      // if it's an explicit property 
      if( mapItem.hasOwnProperty( prop ) ) {
        result = result.concat( this.buildList( mapItem[ prop ], wrapFunc ));
      }
    }


  }
  else if( 'object' === typeof( mapItem )) {

    for (var prop in mapItem) {
      if( mapItem.hasOwnProperty( prop ) ) {
        result = result.concat( this.buildList( mapItem[ prop ], wrapFunc ));
      }
    }

  }

  return result;
};


RegisterMap.prototype.isDirty = function( register ) {

  // if register/object was not specified, check the whole map
  if( 'undefined' === typeof( register )) {
    register = this;
  }

  var list = this.buildList( register );

  var bDirty = false;

  if( Array.isArray( list ) ) {

    // check each register; if any are dirty return true
    list.forEach( function( e ) {
      console.log( e );
      if( e.isDirty ) {
        bDirty = true;
      }
    });
  }

  return bDirty;

};

module.exports = RegisterMap;

  