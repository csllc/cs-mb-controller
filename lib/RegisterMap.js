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

/*
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
*/

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


// Takes a register object containing a buffer of bytes and sets 
// the map items
RegisterMap.prototype.fromRegister = function( register ) {

  //console.log( register );
  //console.log( 'RegisterMap.set ' + register.addr + ' len ' + register.length + ' bytes ' + register.value.length );

  var list = this.buildList( this );

  //console.log( list );

  list.forEach( function( item ) {
    //console.log( 'Register: ' + item.title );

    // set the value of registers that aren't myself, and have an address in my range
    if( item !== register && 
      register.addr <= item.addr && 
      (register.addr + register.length) >= (item.addr + item.length )) {

      //console.log( 'Setting '+ item.title );
      var startIndex = (item.addr-register.addr )*2;
      item.setValue( register.value.slice( startIndex, (startIndex + item.length*2 )) );
      
      //console.log( item );
    }
  });

};

// Retrieves the map item value as a Javascript object
RegisterMap.prototype.get = function( mapItem ) {

  var result;

  if( mapItem instanceof Register ) {

    result = mapItem.format();
   
  }
  else if( 'object' === typeof( mapItem )) {
    result = {};

    for (var prop in mapItem) {
      if( mapItem.hasOwnProperty( prop ) ) {
        result[prop] = this.get( mapItem[ prop ] );
      }
    }

  }

  return result;
};



// Recursively sets register values from a javascript object containing formatted values
// The object structure must match the map item structure else throw 
RegisterMap.prototype.set = function( mapItem, formatted  ) {

  var result;

  if( mapItem instanceof Register ) {

    mapItem.setValue( mapItem.unformat( formatted ));
   
  }
  else if( 'object' === typeof( mapItem )) {

    for (var prop in mapItem) {

      if( formatted.hasOwnProperty( prop )) {
        if( mapItem.hasOwnProperty( prop ) ) {

          this.set( mapItem[ prop ], formatted[prop] );

        }
      }
      else {
        throw new Error( 'No value supplied for ' + prop );
      }
    }

  }

  return result;
};


module.exports = RegisterMap;

  