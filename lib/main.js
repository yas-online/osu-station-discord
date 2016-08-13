"use strict";

if( !process.env.DEBUG && process.execArgv.findIndex( ( sOption ) => sOption.startsWith( "--debug" ) ) !== -1 ) process.env.DEBUG = true;

let g_aArgs = process.argv.slice( 2 );

require( __dirname + "/log" );
const winston = require( "winston" );
const log = winston.loggers.get( "main" );
log.profile( "startup", 500, "debug" );

const Config = require( __dirname + "/config" );
const Console = require( __dirname + "/console" );
const Client = require( __dirname + "/client" );

let g_hConfig = null;
let g_hConsole = null;
let g_hClient = null;

/*
	Cleanup Handling
*/

function CleanupHandler( iCode, pCallback )
{
	log.profile( "cleanup", 500, "debug" );

	if( g_hConsole )
	{
		g_hConsole.Shutdown();
		g_hConsole = null;
	}

	if( g_hClient )
	{
		g_hClient.Shutdown();
		g_hClient = null;
	}

	log.profile( "cleanup" );

	if( typeof pCallback === "function" ) pCallback( iCode );
}

process.once( "beforeExit", CleanupHandler );
process.once( "SIGUSR2", () =>
{
	log.profile( "restart", 1000, "debug" );

	CleanupHandler( 0, ( iCode ) =>
	{
		log.profile( "restart" );
		process.kill( process.pid, "SIGUSR2" );
	} );
} );

/*
	Shutdown Handling
*/

function ExitHandler( hOptions, Error )
{
	log.profile( "exit", 1000, "debug" )

	if( hOptions.abort )
	{
		log.warn( "aborting..." );

		// Try a cleanup anyway...
		CleanupHandler.call( Error );

		// Forever doesn't like exit codes above 0...
		//process.exitCode = 1;
	}
	else if( hOptions.exception )
	{
		log.error( "caught unhandled exception:\n" + Error.stack );
		//process.exitCode = 2;
		process.exitCode = 1;
	}
	else log.debug( "exit code: " + Error );

	if( !isNaN( parseInt( Error ) ) && ( Error != 0 && Error != process.exitCode ) ) log.error( "ExitHandler ExitCode(" + Error + ") != process.exitCode(" + process.exitCode + ")" );

	log.profile( "exit" );
	process.exit();
}

// Application is closing
process.once( "exit", ExitHandler.bind( null, { abort: false, exception: false } ) );

// Catches CTRL + C
process.once( "SIGINT", ExitHandler.bind( null, { abort: true, exception: false } ) );

// Catches process termination (not supported on windows)
process.once( "SIGTERM", ExitHandler.bind( null, { abort: true, exception: false } ) );

// Catches uncaught exceptions
process.once( "uncaughtException", ExitHandler.bind( null, { abort: false, exception: true } ) );

// VisualStudio probably SIGKILL's the process, making it impossible to catch :(((

let g_sArg1 = g_aArgs[0] || null;

if( g_sArg1 !== null && g_sArg1 !== "remote-console" ) g_hConfig = new Config( g_sArg1 );
else g_hConfig = new Config( "bot" );
g_hConfig.CreateDefaultConfig( "" +
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

if( g_sArg1 !== "remote-console" )
{
	g_hClient = new Client( g_hConfig );

	g_hClient.on( "connected", () =>
	{
	} );

	g_hClient.on( "resumed", () =>
	{
	} );

	g_hClient.on( "disconnected", () =>
	{
	} );

	g_hClient.on( "stream-started", ( hConnection ) =>
	{
	} );

	g_hClient.on( "stream-stopped", ( hConnection ) =>
	{
	} );

	g_hClient.on( "set-game", ( sGame ) =>
	{
	} );

	log.profile( "startup" );

	g_hClient.Connect();
}
else log.profile( "startup" );

g_hConsole = new Console( { winston: winston, log: log, g_hConfig: g_hConfig, g_hClient: g_hClient }, g_sArg1 !== "remote-console" );
