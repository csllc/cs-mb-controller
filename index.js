/**
 * Entry point for Control Solutions Node.js package
 *
 * This file exposes the API for communicating with
 * CS's MODBUS Controller products.
 *
 */

'use strict';


// built-in node utility module
var util = require('util');

// Node event emitter module
var EventEmitter = require('events').EventEmitter;

// Include the MODBUS master
var Modbus = require('cs-modbus');

// Promise library
var BPromise = require('bluebird');

// Extra Buffer handling stuff
var buffers = require('h5.buffers');

// Register object definition
var Register = require('./lib/Register');


/**
 * Zero pads a number (on the left) to a specified length
 *
 * @param  {number} number the number to be padded
 * @param  {number} length number of digits to return
 * @return {string}        zero-padded number
 */
function zeroPad( number, length ) {
  var pad = new Array(length + 1).join( '0' );

  return (pad+number).slice(-pad.length);
}

/**
 * Constructor: initializes the object and declares its public interface
 *
 * @param string name: the name of the port (as known to the operating system)
 * @param object config: optional object containing configuration parameters:
 */
function Port ( options ) {
  var me = this;

  // expose these constructors, mainly for browserified version
  me.Buffer = Buffer;
  me.BufferReader = buffers.BufferReader;
  me.BufferBuilder = buffers.BufferBuilder;

  // for debugging
  BPromise.longStackTraces();

  // Initialize the state of this object instance
  //me.name = name;

  // keep track of reconnection timers
  me.reconnectTimer = null;

  // Modbus object IDs for this device
  me.object = {
    FACTORY           : 0,
    USER              : 1,
    NET_STATUS        : 2,
    SCAN_RESULT       : 3,
    CONNECTION_TABLE  : 4,
    COORD_STATUS      : 5,

    SENSOR_DATA       : 7
  };


  me.commands = [
  '',
  'reset',
  'save',
  'restore',
  'pair',
  'clear',
  'sendconn',
  'sendshort',
  'sendlong',
  'broadcast',
  'scan',
  'ping'
  ];


  // Create the MODBUS master using the supplied options
  me.master = Modbus.createMaster( options.master );

  // Pass through the connected event from the master to our client
  me.master.on('connected', this.emit.bind(this, 'connected'));

  // Catch an event if the port gets disconnected
  me.master.on( 'disconnected', function() {

    // FYI - the port object drops all listeners when it disconnects
    // but after the disconnected event, so they haven't been dropped at
    // this point.

    me.emit( 'disconnected');

    // let the port finish disconnecting, then work on reconnecting
    //process.nextTick( function() { me.reconnect(); } );

  });
}

// This object can emit events.  Note, the inherits
// call needs to be before .prototype. additions for some reason
util.inherits( Port, EventEmitter );

/**
 * Converts a 16-bit short address into a string like 'A1B2'
 * @param  {Buffer} buffer buffer containing the bytes to format
 * @param  {number} offset offset into the buffer to start reading
 * @return {string}        a string containing the 16-bit hex value
 */
Port.prototype.destroy = function() {

  // this causes an error about port not open; I think it gets cleaned 
  // up in master destroy anyway
  //this.port.close();
  this.master.destroy();

};

/**
 * Zero pads a number (on the left) to a specified length
 *
 * @param  {number} number the number to be padded
 * @param  {number} length number of digits to return
 * @return {string}        zero-padded number
 */
Port.prototype.zeroPad = function( number, length ) {
  var pad = new Array(length + 1).join( '0' );

  return (pad+number).slice(-pad.length);
};


/**
 * Queries the MODBUS SlaveID
 *
 * @return {Promise} resolves when transaction is complete
 */
Port.prototype.readId = function() {

  var me = this;

  return new BPromise(function(resolve, reject){

    me.master.reportSlaveId({
      onComplete: function(err, response) {
        if( err ){
          reject( err );
        }
        else {
          var additional = response.getValues();
          
          // Read serial number and product ID if they exist
          var serial = 0;
          var productId = 0;

          if( additional.length >= 4 ) {
            serial = additional.readUInt32BE(0);
          }

          if( additional.length >= 8 ) {
            productId = additional.readUInt32BE(4); 
          }

          resolve( {
            id: response.product,            
            run: response.run,
            version: response.getVersion(),
            serialNumber: serial,
            productId: productId
            
          });
        }
      }
    });
  });

};



/**
 * Sends a command to the slave
 *
 * @param {number} id command ID
 * @param {Buffer} data additional bytes to send
 *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.command = function( cmd, data ) {

  var me = this;

  return new BPromise(function(resolve, reject){
    var id = me.commands.indexOf(cmd );

    me.master.command( id, data, {
      onComplete: function(err,response) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( response );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });
  });
};

/**
 * Sends a command to the slave
 *
 * @param {number} id command ID
 * @param {Buffer} data additional bytes to send
 *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.unlock = function() {

  var me = this;

  return new BPromise(function(resolve, reject){

    me.master.command( 255, new Buffer(0), {
      onComplete: function(err,response) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( response );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });
  });
};

/**
 * Writes multiple values to the slave
 *
 * @param {number} id command ID
 * @param {Buffer} data additional bytes to send
 *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.setRegisters = function( address, values ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    var builder = new buffers.BufferBuilder();

    for( var i = 0; i < values.length; i++ ) {
      builder
        .pushUInt16( values[i] );
    }

    me.master.writeMultipleRegisters( address, builder.toBuffer(), {
      onComplete: function(err,response) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( response );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });
  });
};

/*
Controller.prototype.readMap = function( mapItem ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    var list = buildRegisterList( mapItem );

    var todo = [];

    _.each( list, function( reg ) {
      todo.push( me.readRegister( reg ));
    });
    //console.log( 'list: ', list );

    BPromise.all( todo )
    .then( function( result ) {

      resolve( result);
    })
    .catch( function(err) {

      reject( err );
    });

  });
          
};
*/

/**
 * Recursively find registers in a register map object
 * 
 * @param  {[type]} mapItem [description]
 * @param {function} wrapFunc Function to wrap the register before it is appended to the list
 * @return {array}  array containing wrapped Register objects
 */
function buildRegisterList( mapItem, wrapFunc ) {

  var result = [];

  if( mapItem instanceof Register ) {

    if( 'function' === typeof( wrapFunc ) ) {
      result.push( wrapFunc( mapItem ));
    }
    else {
      result.push( mapItem );

    }

  }
  else if( 'object' === typeof( mapItem ) && !(mapItem instanceof Buffer)) {

    for (var prop in mapItem) {
      if( mapItem.hasOwnProperty( prop ) ) {
        result = result.concat( buildRegisterList( mapItem[ prop ], wrapFunc ));
      }
    }

  }

  return result;
}

/**
 * Reads a register item from the slave
 *
 * @returns {Promise} that resolves when the read operation is complete
 */
Port.prototype.readRegister = function( reg ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    var callback = {
      onComplete: function(err, response ) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          //console.log( 'resp: ', response );
          reg.setValue( response.values );

          resolve( reg );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    };

   if( reg.type === 'object') {
     me.master.readObject( reg.addr, callback );

    }
    else {
      
      //console.log( 'reading ' + reg.length + ' registers from 0x' + reg.addr.toString(16) );
      me.master.readHoldingRegisters( reg.addr, reg.length, callback );
    }

  });
  

};


/**
 * Writes a register item to the slave
 *
 * @returns {Promise} that resolves when the operation is complete
 */
Port.prototype.writeRegister = function( reg ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    var callback = {
      onComplete: function(err, response ) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          //console.log( reg.title + ' write result: ', response );
          resolve( reg );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    };

   if( reg.type === 'object') {
     me.master.writeObject( reg.addr, reg.value, callback );

    }
    else {
      
      //console.log( 'writing ' + reg.length + ' registers to 0x' + reg.addr.toString(16), 'buf: ', reg.toBuffer() );

      me.master.writeMultipleRegisters( reg.addr, reg.toBuffer(), callback );
    }

  });
  

};


/**
 * Reads registers from the slave
 *
 * @param {object} items
  *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.read = function( item ) {

  var me = this;

  // hold an array of promises, one for each device query
  var list = buildRegisterList( item, me.readRegister.bind(this) );

  //console.log( 'Reading ' +  list.length + ' registers');

  // if only one item, return a single promise (resolves to a Register)
  // If multiple registers, the promise resolves to an array of Registers
  // if no items to read, the promise rejects immediately
  if( list.length === 1 ) {
    return  list[0];
  }
  else if( list.length === 0 ) {
    return  BPromise.reject( 'No Registers to read');
  }
  else {
    return BPromise.all( list );
  }

};


/**
 * Writes registers to the slave
 *
 * @param {object} items
  *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.write = function( item ) {

  var me = this;

  // hold an array of promises, one for each device query
  var list = buildRegisterList( item, me.writeRegister.bind(this) );

  console.log( 'Writing ' +  list.length + ' registers');

  // if only one item, return a single promise (resolves to a Register)
  // If multiple registers, the promise resolves to an array of Registers
  // if no items to read, the promise rejects immediately
  if( list.length === 1 ) {
    return  list[0];
  }
  else if( list.length === 0 ) {
    return  BPromise.reject( 'No Registers to write');
  }
  else {
    return BPromise.all( list );
  }

};


/**
 * Read the entire controller configuration
 *
 * @returns Promise instance that resolves when command is completed
 */
 /*
Port.prototype.readConfig = function() {

  var me = this;

  var todo = [
    me.readHolding( BANK_EEPROM, 64 ),
    me.readHolding( BANK_EEPROM + 64, BANK_EEPROM_SIZE - 64 )
  ];

  // hold an array of promises, one for each device query
  var list = buildRegisterList( item, me.readRegister.bind(this) );

  console.log( 'Reading ' +  list.length + ' registers');

  return new BPromise(function(resolve, reject){

    BPromise.all( list )
    .then( function( result ) {

      resolve( result);
    })
    .catch( function(err) {

      reject( err );
    });

  });
};
*/

/**
 * Writes a Register item to the slave
 *
 * @param {object} item
 * @param {varies} value value to be written
  *
 * @returns Promise instance that resolves when command is completed
 */
/*
Port.prototype.write = function( item, value ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    item.unformat( value );

    var t1 = me.master.writeMultipleRegisters( item.addr, item.toBuffer(), {
      onComplete: function(err, response ) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( true );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });

  });
};
*/

/**
 * Resets the device
 *
 * @param {number} type
 * @param {number} duration enumeration indicating amount of time to dwell on each channel
  *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.reset = function() {

  var me = this;

  return new BPromise(function(resolve, reject){

    var id = me.commands.indexOf('reset' );

    me.master.command( id, new Buffer(0), {
      timeout: 5000,
      onComplete: function(err, response ) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( response.values[0] );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });

  });
};


/**
 * Returns an instance of the register map
 *
 * Caller can supply parameters to help choose the correct map
 * 
 * @param  {number} productId product type
 * 
 * @return {object} instance of a map containing Registers, or null if not found      
 */
Port.prototype.createMap = function( productId ) {

  var Map;

  switch( productId ){
    //case 0x11080000:
      //Map = require('./lib/map/cs1108_default');
     // break;

    //case 0x00000000:
    //case 0x81000000:
    //case 0x00001108:
    default:
      Map = require('./lib/map/cs8100_default');
      break;

    //default:
    //  return null;

  }

  return new Map();


};


/**
 * Public interface to this module
 *
 * The object constructor is available to our client
 *
 * @ignore
 */
module.exports = Port;

