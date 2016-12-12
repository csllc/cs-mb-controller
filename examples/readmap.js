#!/usr/bin/env node
/**
 * Example program that connects to a serial port and retrieves the SLAVE ID.
 * This is similar to the serial.js example, but hooks a lot of debug events
 * to print extra information about the transaction
 *
 */
'use strict';

// Load the object definition that manages the controller interface
var Controller = require('../index');

// Module which manages the serial port
var SerialPort = require('serialport');

// parse command-line options into args object
var args = require('minimist')(process.argv.slice(2));


// Configuration defaults
var config = {

	// Serial port configuration options
	port : {

		// Modify name to your serial port identifier (eg COM2)
		name : '/dev/cu.usbserial-FTYXQCAR',

		// set to the correct baud rate for your device.
		// Other serial port options are available; see
		// https://github.com/EmergingTechnologyAdvisors/node-serialport#serialportopenoptions--object
		'options' : {
			'baudrate': 115200
		}
	},

	// Configuration for the MODBUS master's behavior
	master : {
			transport: {
				type: 'rtu',
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
	process.exit( 1 );
}


// Create and open the serial port
var serialport = new SerialPort( config.port.name, config.port.options );


// Reference the port object in the master's options
// so it can access the port
config.master.transport.connection.serialPort = serialport;

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

			// exit the program
			process.exit(0);
		})
		.catch( errorExit );

	})
	.catch( errorExit );

});


// If user entered -v command line switch, enable debug outputs
if( args.v ) {
// Connection layer debug
	var connection = controller.master.getConnection();

	connection.on('open', function()
	{
	  console.log('[connection#open]');
	});

	connection.on('close', function()
	{
	  console.log('[connection#close]');
	});

	connection.on('error', function(err)
	{
	  console.log('[connection#error] %s', err.message);
	});

	connection.on('write', function(data)
	{
	  console.log('[connection#write]', data );
	});

	connection.on('data', function(data)
	{
	  console.log('[connection#data]', data.length, data );
	});
}

