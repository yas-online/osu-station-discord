"use strict";

const util = require( "util" );

const Config = require( "./config" );
const Client = require( "./client" );

function CleanupHandler( iCode, pCallback )
{
	console.log( "cleanup..." );

	if( hClient )
	{
		if( hClient.IsConnected() )
		{
			hClient.StopStreaming();
			hClient.Disconnect();
		}
		hClient = null;
	}

	if( typeof pCallback === "function" ) pCallback( iCode );
}

process.once( "beforeExit", CleanupHandler );
process.once( "SIGUSR2", () =>
{
	CleanupHandler( 0, ( iCode ) =>
	{
		process.kill( process.pid, "SIGUSR2" );
	} );
} );

function ExitHandler( hOptions, Error )
{
	if( hOptions.abort )
	{
		console.error( "aborting..." );

		// Try a cleanup anyway...
		CleanupHandler.call( Error );

		process.exitCode = 1;
	}
	else if( hOptions.exception )
	{
		console.error( "caught unhandled exception:\n" + Error.stack );
		process.exitCode = 2;
	}
	else console.log( "exit code: " + Error );

	if( !isNaN( parseInt( Error ) ) && ( Error != 0 && Error != process.exitCode ) ) console.error( "ExitHandler ExitCode(" + Error + ") != process.exitCode(" + process.exitCode + ")" );
	process.exit();
}

// Application is closing
process.on( "exit", ExitHandler.bind( null, { abort: false, exception: false } ) );

// Catches CTRL + C
process.on( "SIGINT", ExitHandler.bind( null, { abort: true, exception: false } ) );

// Catches process termination (not supported on windows)
process.on( "SIGTERM", ExitHandler.bind( null, { abort: true, exception: false } ) );

// Catches uncaught exceptions
process.on( "uncaughtException", ExitHandler.bind( null, { abort: false, exception: true } ) );

// WHERE'S MAH DEBUGGER TERMINATION EVENT :(((((

// ToDo: make "bot" config name a script argument...
let hConfig = new Config( "bot" );
hConfig.CreateDefaultConfig( "" +
"{\n" +
"	// Discord BotUser login\n" +
"	\"auth\":\n" +
"	{\n" +
"//		\"token\": \"<insert api token here>\"\n" +
"	},\n" +
"\n" +
"	// If you want to be able to get special bot access (ex. via DM) fill these out\n" +
"	\"owner\":\n" +
"	{\n" +
"		// If you know your snowflake id, uncomment and enter here\n" +
"		//\"id\": -1\n" +
"\n" +
"		// Since usernames aren't unique, provide username + discriminator (your #id below / behind the name)\n" +
"//		\"username\": \"<enter your username here>\",\n" +
"//		\"discriminator\": <enter your snowflake id here>\n" +
"\n" +
"		// You could theoretically try to get yourself via your e-mail address, not recommended though\n" +
"		//\"email\": \"<insert your e-mail here>\"\n" +
"	},\n" +
"\n" +
"	// General settings\n" +
"	\"general\":\n" +
"	{\n" +
"		// Default volume the bot should use\n" +
"		\"volume\": 50\n" +
"	}\n" +
"}\n" );

let hClient = new Client( hConfig );

hClient.Connect();
