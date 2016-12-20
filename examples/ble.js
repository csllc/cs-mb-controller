#!/usr/bin/env node
/**
 * Example program that connects to a bluetooth serial port and retrieves the SLAVE ID.
 * You will need to modify the config object below; at a minimim, set the serial port name 
 * to the correct value for your system. 
 *
 */
'use strict';

// Load the object definition that manages the controller interface
var Controller = require('../index');

// Module which provides BLE interfaces
var BlePort = require('./ble_serial');


// Configuration defaults
var config = {

	// BLE port configuration options
	ble : {

	},

	// Configuration for the MODBUS master's behavior
	master : {
		transport: {
			type: 'ip',
			eofTimeout: 200,
			
			connection: {
				type: 'serial',
			}
		},
		suppressTransactionErrors: true,
		retryOnException: false,
		maxConcurrentRequests: 1,
		defaultUnit: 1,
		defaultMaxRetries: 0,
		defaultTimeout: 2000
	}

};

/**
 * A common error trap
 */
function errorExit( err ) {
  console.log( err.message );
  
  //process.exit( 1 );
}


// Create the BLE interface
var bleport = new BlePort( config.ble );

// Wait for the bluetooth hardware to become ready
bleport.on('stateChange', function(state) {

  if(state === 'poweredOff') {

    console.log('Bluetooth must be turned on');

  }
  else if(state === 'poweredOn') {

    // Register for events each time a matching BLE peripheral is discovered
    bleport.on('discover', function( peripheral ) {

      // stop after the first found, we just connect to the first one in this demo
      bleport.stopScanning();

      console.log( peripheral );
      console.log( 'Found ' + peripheral.advertisement.localName );

      bleport.connect( peripheral )
      .then( function() {

        // Ask for async notifications on fault change
        bleport.subscribeFault( function( message ){
          console.log( 'FAULT: ', message );
        });

        // Ask for async notifications on controller status
        bleport.subscribeStatus( function( message ){
          console.log( 'Status: ', message );
        });

      });

    });

    // Capture the event that is emitted when bluetooth goes into scanning mode
    bleport.on('scanStart', function(){
      console.log( 'Scanning...');
    });

    // Capture the event emitted when scan mode ends
    bleport.on('scanStop', function(){
      console.log( 'Stopped Scanning...');
    });

    // Capture the event emitted when scan mode ends
    bleport.on('warning', function( message ){
      console.log( 'BLE Warning: ', message );
    });

 
    // Put the bluetooth hardware into scan mode
    bleport.startScanning();

  }
});


// Reference the port object in the master's options
// so it can access the port
config.master.transport.connection.serialPort = bleport;

// Create the MODBUS master using the supplied options (and serial port instance)
var controller = new Controller( config );

// When the serial port is opened, the controller will emit a 'connected' event
controller.on('connected', function() {

	// so we now request the slaveId from the device
	controller.readId()

	.then( function( result ) {
    // result has the slave identifying information.
    // Use it to select the correct memory map

    console.log( 'Connected to Controller model ' + result.productId + 
      ' Version ' + result.version +
      ' Serial# ' + result.serialNumber  );

    var map = controller.createMap( result.productId );

    // Iterate through the entire map and read all the values
    controller.read( map.config )

    .then( function( result ) {

      console.log( result.format() );

      
    })
    .then( function() {

      // leave things running to monitor status


      // exit the program
      //process.exit(0);
    })
    .catch( errorExit );
	})
  .catch( errorExit );



});



