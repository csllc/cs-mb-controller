#!/usr/bin/env node
/**
 * Command Line utility to identify connected controllers
 *
 * Invoke with -h option for help
 *
 */
'use strict';

// get application path
var path = require('path');

// console text formatting
var chalk = require('chalk');

// command-line options
var args = require('minimist')(process.argv.slice(2));

// Configuration defaults
var config = require('./config');

// Keep track of mode for output purposes
var isAscii = (config.master.transport.type === 'ascii');

// Load the object that handles communication to the device
var Port = require('./index');

// Load the object that handles communication to the device
var map = require('./lib/Map');

// override config file port name if necessary
config.port.name = args.port || process.env.MODBUS_PORT || config.port.name;

// override slave id if necessary
config.master.defaultUnit = args.slave ||
  process.env.MODBUS_SLAVE || config.master.defaultUnit;


var serialConfig = {
  "port" : {
    "name" : "/dev/cu.usbserial-FTYXQCAR",
    "options" : {
      "baudrate": 115200
    }
  },
  "master" : {
      "transport": {
        "type": "rtu",
        "eofTimeout": 100,
        "connection": {
            "type": "serial"
          }
        },
      "suppressTransactionErrors": true,
      "retryOnException": false,
      "maxConcurrentRequests": 1,
      "defaultUnit": 1,
      "defaultMaxRetries": 0,
      "defaultTimeout": 2000
  }

};



/**
 * Cleanup and terminate the process
 *
 * @param  {[type]} code [description]
 * @return {[type]}      [description]
 */
function exit(code ) {
  port.destroy();
  process.exit(code);
}

if( args.h ) {
  console.info( '\r--------MODBUS Controller Identification Utility----------');
  console.info( 'Checks available ports for presence of a controller.\r');
  console.info( '\rCommand format:\r');
  console.info(
    path.basename(__filename, '.js') + '[-h -v] action [type] [...]\r');
  console.info( '    action:\r');
  console.info( chalk.bold('        read') + '  item\r');
  console.info( chalk.bold('        write') + ' item [value]\r');
  console.info(
    chalk.bold('        slaveId') + ': Report Identity information\r');
  console.info( chalk.bold('        reset') + '  : Reset the device\r');
  console.info( chalk.underline('Items for read/write:\r'));
  Object.keys(map).forEach(function (key) {
    console.info( chalk.bold(key) );
  });
  console.info( chalk.underline( '\rOptions\r'));
  console.info( '    -h          This help output\r');
  console.info( '    -l          List all ports on the system\r');
  console.info( '    -v          Verbose output (for debugging)\r');
  console.info( '    --port      Specify serial port to use\r');
  console.info( '    --loop      Run the command continuously\r');
  console.info(
    '    --slave     Specify MODBUS slave ID to communicate with\r');
  console.info( chalk.underline( '\rResult\r'));
  console.info( 'Return value is 0 if successful\r');

  process.exit(0);
}

var portsToIgnore = [
  '/dev/cu.lpss-serial1',
  '/dev/cu.lpss-serial2',
  '/dev/cu.Bluetooth-Incoming-Port'
];

var baudRates = [115200, 19200, 9600 ];

function scanSerialPort( name, rates ) {

  if( portsToIgnore.indexOf(name) > -1  ) {
    return;
  }

  
  console.log( 'Opening ' + name );

  var config = serialConfig;

  config.port.name = name;
  config.port.options.baudrate = rates[0];

  var port = new Port( name, config );

  // Attach event handler for the port opening
  port.master.once( 'connected', function() {
console.log( 'Connected ' + name );
    rates.forEach( function( rate ) {

      // print each port description
      console.log( 'Scanning ' + name +
          ' : ' + rate );

      //   process.exit(0);

    });
  });

  // port errors
  port.on('error', function( err ) {
    console.error( chalk.underline.bold( name + ': ' + err.message ));
    //exit(1);
  });

  // Open the port
  // the 'connected' event is triggered when complete
  port.open()
  .then( function() {
    console.log( name + ' opened');
  })
  .catch( function( err ) {
    console.log( name + ': ', err);
    //exit(1);
  });

}

// Get a list of all available serial ports
var port = new Port( config.port.name, config );

// Retrieve a list of all ports detected on the system
port.list(function (err, ports) {

  if( err ) {
    console.error( err );
  }

  if( ports ) {
    // ports is now an array of port descriptions.
    ports.forEach(function(port) {

      scanSerialPort( port.comName, baudRates );


    });
  }

});

