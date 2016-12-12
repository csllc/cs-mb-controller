/**
 * Module file that creates a Bluetooth low energy interface using the NOBLE library.
 *
 * This is not an example per se, but is used by other examples (like the ble.js example)
 * to show how a BLE port can be used for MODBUS communication.
 *
 * The modbus library can use a connection type of 'serial'; normally an instance of
 * the serialport package is supplied to interface to hardware serial ports.   In this case,
 * we define an object that has at least the minimum necessary interfaces to look like a 
 * serialport object to the MODBUS stack.
 *
 * We emit the following events:
 * 		open when the port is opened
 *		close when the port is closed
 *		error( err ) on error events
 *		data( buffer ) when incoming data is detected
 *		
 *
 * 
 */
'use strict';

// Bluetooth low energy library
var ble = require('noble');

// built-in node utility module
var util = require('util');

// Promise library
var BPromise = require('bluebird');

// utility library
var _ = require('underscore');

// buffer helper
var buffers = require('h5.buffers');

// Node event emitter module
var EventEmitter = require('events').EventEmitter;


//------------------------------------//---------------------------------------


/**
 * Constructor
 *
 * Initializes and hooks events
 */
function BleSerial() {

  var me = this;

  // subclass to event emitter
  EventEmitter.call( this );

  //------------------------------------//---------------------------------------
  // Definitions for BLE UUIDs 

  // UUID for the CSLLC private controller service
  //this.uuidLocationService = '7765ed1f4de149e14771a14380c90000';

  // the characteristics for the Location service
  //this.uuidPosition = '7765ed1f4de149e14771a14380c90001';


  // UUID for the CSLLC private controller service
  this.uuidControllerService = '6765ed1f4de149e14771a14380c90000';

  // the characteristics for the Controller service
  this.uuidCommand = '6765ed1f4de149e14771a14380c90001';
  this.uuidResponse = '6765ed1f4de149e14771a14380c90002';
  this.uuidProduct = '6765ed1f4de149e14771a14380c90003';
  this.uuidSerial = '6765ed1f4de149e14771a14380c90004';
  this.uuidFault =  '6765ed1f4de149e14771a14380c90005';
  this.uuidStatus =  '6765ed1f4de149e14771a14380c90006';

  // store the characteristics when discovered
  this.commandChar = null;
  this.responseChar = null;
  this.productChar = null;
  this.serialChar = null;
  this.faultChar = null;
  this.statusChar = null;
  

  // Pass on BLE state change events (noble library events passed
  // through to our event listeners)
  ble.on('stateChange', this.emit.bind(me, 'stateChange'));
  ble.on('scanStart', this.emit.bind(me, 'scanStart'));
  ble.on('scanStop', this.emit.bind(me, 'scanStop'));
  ble.on('warning', this.emit.bind(me, 'warning'));
  ble.on('discover', this.emit.bind(me, 'discover'));

  // the fd member indicates whether the 'serial port' is open or not
  this.fd = null;

  this.peripheral = null;

}

// This object can emit events.  Note, the inherits
// call needs to be before .prototype. additions for some reason
util.inherits( BleSerial, EventEmitter );


/**
 * API to tell bluetooth to start scanning
 */
BleSerial.prototype.startScanning = function( cb ){

  // Scan for devices with the service we care about
  // This does not connect; just emits a discover event
  // when one is detected 
  ble.startScanning([this.uuidControllerService], false);
};

/**
 * API to tell bluetooth to stop scanning
 */
BleSerial.prototype.stopScanning = function( cb ){

  ble.stopScanning();
};

/**
 * Inspect the characteristics/services of the connected device
 * 
 * @param {function} cb(err) is called when completed. 
 * 
 * We store the characteristic objects for later access
 */
BleSerial.prototype.inspectDevice = function( cb ){

  var me = this;

  console.log( 'BleSerial::inspectDevice');

  var serviceUUIDs = [ 
    me.uuidControllerService, 
    //me.uuidLocationService 
    ];

    var characteristicUUIDs = [ 
      me.uuidCommand, 
      me.uuidResponse,
      me.uuidProduct,
      me.uuidSerial,
      me.uuidFault,
      me.uuidStatus,

      //me.uuidPosition 
      ];

  
    me.peripheral.discoverSomeServicesAndCharacteristics(
      serviceUUIDs, characteristicUUIDs, function(err, services, characteristics){

 
      if( err ) {
        return cb( err );
      }
      else {
        
        me.controllerService = _.findWhere(services, {uuid: me.uuidControllerService });
        //me.uartService = _.findWhere(services, {uuid: me.uuidUartService });

        me.commandChar = _.findWhere(characteristics, {uuid: me.uuidCommand });
        me.responseChar = _.findWhere(characteristics, {uuid: me.uuidResponse });
        me.productChar = _.findWhere(characteristics, {uuid: me.uuidProduct });
        me.serialChar = _.findWhere(characteristics, {uuid: me.uuidSerial });
        me.faultChar = _.findWhere(characteristics, {uuid: me.uuidFault });
        me.statusChar = _.findWhere(characteristics, {uuid: me.uuidStatus });

        //me.positionChar = _.findWhere(characteristics, {uuid: me.uuidPosition });


        // Make sure the device has all the expected characteristics
        if( me.commandChar && 
          me.responseChar &&
          me.controllerService && 
          me.productChar &&
          me.serialChar &&
           me.faultChar &&
           me.statusChar ) {
          
          // read the characteristics
          me.readCharacteristic( me.productChar )
          .then( function( product ) {
            console.log( 'Product: ', product.toString() );

            me.deviceType = product.toString();
          })
          .then( function() { return me.readCharacteristic( me.serialChar ); })
          .then( function( serial ) {

            console.log( 'Serial: ', serial );
            me.serial = serial.toString();

          })
          .then( function() { return me.readCharacteristic( me.faultChar ); })
          .then( function( fault ) {

            console.log( 'Fault: ', fault );
            me.fault = fault[0];
          })
          .then( function() {

            // Catch response events emitted events from this controller
            me.responseChar.on('data', me.onResponse.bind(me));            
          })
          .then( function() { return me.subscribeCharacteristic( me.responseChar ); })

          .then( function() { 

            // success!
            return cb();
          })

          .catch( function( err ) {
            return cb( err );
          });

            
        }
        else {
          return cb (new Error( 'Device services/characteristics are not compatible'));
        }
      }
    });
  };


/**
 * API call to attempt connection with a discovered peripheral
 */
BleSerial.prototype.connect = function( peripheral ){
  
  var me = this;

  return new BPromise( function( resolve, reject ){

    console.log( 'BleSerial::connect');

    // Make a bluetooth connection to the device
    peripheral.connect(function(err) {
        
      if( err ) {
        me.emit( 'error', err );
        reject( err );
      }
      else {

        // save for later reference
        me.peripheral = peripheral;

        // interrogate the device type, etc and register for events
        me.inspectDevice( function( err ) {

          if( err ) {
            ble.disconnect();
            me.peripheral = null;
            me.fd = null;
            me.emit( 'error', err );
            reject( err );
          }
          else {
            
            // make-believe file descriptor so modbus thinks the port is open
            me.fd = 1;

            // we are ready for business
            me.emit( 'open');
            resolve();
          }

        });
      }
    });
  });
};


/**
 * Test to see if we are connected to a device
 * 
 * @return {Boolean} true if connnected
 */
BleSerial.prototype.isConnected = function() {

  return( this.peripheral && this.controllerService );

};


/**
 * Read a characteristic and return its value
 * 
 * @return {Promise} resolves when the characteristic is read
 */
BleSerial.prototype.readCharacteristic = function( characteristic ) {

  var me = this;

  return new BPromise( function( resolve, reject ){

    // If there is a controller service, we are connected
    if( me.isConnected() ) {

      characteristic.read( function( err, data ) {

      resolve(data);

      });
     
    }
    else {
      reject();
    }
  });

};


/**
 * Write a characteristic to the specified value
 * 
 * @return {Promise} resolves when the write is finished
 */
BleSerial.prototype.writeCharacteristic = function( characteristic, value ) {

  var me = this;

  return new BPromise( function( resolve, reject ){

    // If there is a controller service, we are connected
    if( me.isConnected() ) {

      characteristic.write( value, function( err, data ) {
        if( err ) {
          reject( err );
        }
        else {
          resolve( data );
        }

      });
     
    }
    else {
      reject();
    }
  });

};


/**
 * Subscribe for notification on updates for a characteristic
 *
 *
 * @return {Promise} resolves when the subscription is complete
 */
BleSerial.prototype.subscribeCharacteristic = function( characteristic ) {

  //var me = this;

  return new BPromise( function( resolve, reject ){

    characteristic.subscribe(function(err) {
      if( err ) {
        reject( new Error( 'Failed to subscribe to characteristic'));
      }
      else {
        resolve();
      }
    });
  });

};

/**
 * Subscribe for notification of controller faults
 *
 * These notifications arrive asynchronously from the BLE peripheral

 * @return {Promise} resolves when the subscription is complete
 */
BleSerial.prototype.subscribeFault = function( cb ) {

  var me = this;

  return new BPromise( function( resolve, reject ){
    
    if( me.faultChar ) {

      me.subscribeCharacteristic( me.faultChar )
      .then( function(result) {

        // catch the notifications and give them to caller's callback
        me.faultChar.on('data', cb );

        resolve( result );
      })
      .catch( function (err) {
        reject( err );
      });
    }
  });

};

/**
 * Subscribe for notification of controller status
 *
 * These notifications arrive asynchronously from the BLE peripheral

 * @return {Promise} resolves when the subscription is complete
 */
BleSerial.prototype.subscribeStatus = function( cb ) {

  var me = this;

  return new BPromise( function( resolve, reject ){
    
    if( me.statusChar ) {
      
      me.subscribeCharacteristic( me.statusChar )
      .then( function(result) {

        // catch the notifications and give them to caller's callback
        me.statusChar.on('data', cb );

        resolve( result );
      })
      .catch( function (err) {
        reject( err );
      });
    }
  });

};


/**
 * Handler for data notification on the Response characteristic
 */
BleSerial.prototype.onResponse = function( response ) {

  var me = this;

  console.log( 'response ', response );

  // forward the data on to our client
  this.emit( 'data', response );


};

/**
 * Handler for notification of a fault.
 *
 */
BleSerial.prototype.onFault = function( fault ) {
  console.log( 'on fault: ', fault );
  this.emit( 'controllerfault', fault );

};

/**
 * Handler for notification of change to status characteristic.
 *
 */
BleSerial.prototype.onStatus = function( status ) {
  console.log( 'on status: ', status );
  this.emit( 'controllerstatus', status );
  
};



/**
 * API used when the application wants to terminate a connection to the device (if any)
 */
BleSerial.prototype.close = function(){
	console.log( 'BleSerial::close');

	ble.stopScanning();
  ble.disconnect();

  // @todo probably need to do something with event handlers hooked to the 
  // status and fault characteristics...

	this.emit( 'close');

};


/**
 * API needed for the MODBUS serial connection pattern. 
 *
 * We don't need to do anything here; it is about setting serial port options
 */
BleSerial.prototype.set = function(){
	console.log( 'BleSerial::set');
};

/**
 * API to request a callback when transmission is complete.
 * 
 * I'm not sure if this is important to implement; it would have to be hooked into
 * a confirmation in the noble stack...
 */
BleSerial.prototype.drain = function( cb ){
	console.log( 'BleSerial::drain');

	if( 'function' === typeof( cb ) ){
		cb();
	}
};

/**
 * API Call to write a buffer of data to the peripheral
 *
 * Depending on the BLE library, this will need to be broken 
 * up into multiple writes if the data.length is greater than
 * the maximum size of a BLE write (the writes can be up to 
 * 260 or so bytes at maximum - depending on the MODBUS transport used)
 */
BleSerial.prototype.write = function( data ){
	
  var me = this;

  console.log( 'BleSerial::write', data );

  me.writeCharacteristic( me.commandChar, data , function (err)  {

    if( err ) {
      console.log( 'BLE send error', err );

    }
    else {
      console.log( 'BLE send success');

    }
  });


};



/**
 * Public interface to this module
 *
 * The object constructor is available to our client
 *
 * @ignore
 */
module.exports = BleSerial;



