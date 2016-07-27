"use strict";

let g_hCPUUsage = null;
let g_hMemoryUsage = null;

let g_iByteToMB = 1024 * 1024;

function GetStats( hCPUUsage, hMemoryUsage )
{
	let bCPUDiff = false;
	let bMemoryDiff = false;

	if( typeof hCPUUsage !== "object" ) hCPUUsage = g_hCPUUsage = process.cpuUsage();
	else
	{
		bCPUDiff = true;
		hCPUUsage = g_hCPUUsage = process.cpuUsage( hCPUUsage );
	}

	hCPUUsage.user /= 1000;
	hCPUUsage.system /= 1000;

	if( typeof hMemoryUsage !== "object" ) hMemoryUsage = g_hMemoryUsage = process.memoryUsage();
	else
	{
		bMemoryDiff = true;

		let hLastMemoryUsage = hMemoryUsage;
		hMemoryUsage = g_hMemoryUsage = process.memoryUsage();

		hMemoryUsage.rss -= hLastMemoryUsage.rss;
		hMemoryUsage.heapTotal -= hLastMemoryUsage.heapTotal;
		hMemoryUsage.heapUsed -= hLastMemoryUsage.heapUsed;
	}

	hMemoryUsage.rss /= g_iByteToMB;
	hMemoryUsage.heapTotal /= g_iByteToMB;
	hMemoryUsage.heapUsed /= g_iByteToMB;

	console.info( "\n" +
		"CPU Usage" + ( bCPUDiff ? " (Diff'd)" : "" ) + ":\n" +
		"\tUser: " + hCPUUsage.user.toPrecision( 2 ) + "ms\n" +
		"\tSystem: " + hCPUUsage.system.toPrecision( 2 ) + "ms"
	);

	console.info( "" +
		"Memory Usage" + ( bMemoryDiff ? " (Diff'd)" : "" ) + ":\n" +
		"\tHeap Usage: " + hMemoryUsage.heapTotal.toPrecision( 2 ) + "MB / " + hMemoryUsage.rss.toPrecision( 2 ) + "MB\n" +
		"\tActive Heap: " + hMemoryUsage.heapUsed.toPrecision( 2 ) + "MB"
	);
}

GetStats();

let g_aArgs = process.argv.slice( 2 );
// Make sure nothing reaches our childs... (And yet it does somehow, wtf VS)
process.argv = process.argv.slice( 0, 2 );

const Config = require( __dirname + "/config" );
const Client = require( __dirname + "/client" );

let g_hClient = null;

/*
	Cleanup Handling
*/

function CleanupHandler( iCode, pCallback )
{
	console.log( "cleanup..." );

	if( g_hClient )
	{
		g_hClient.Shutdown();
		g_hClient = null;
	}

	if( typeof pCallback === "function" ) pCallback( iCode );
}

process.once( "beforeExit", CleanupHandler );
process.once( "SIGUSR2", () =>
{
	CleanupHandler( 0, ( iCode ) =>
	{
		GetStats();
		process.kill( process.pid, "SIGUSR2" );
	} );
} );

/*
	Shutdown Handling
*/

function ExitHandler( hOptions, Error )
{
	if( hOptions.abort )
	{
		console.error( "aborting..." );

		// Try a cleanup anyway...
		CleanupHandler.call( Error );

		// Forever doesn't like exit codes above 0...
		//process.exitCode = 1;

		GetStats();
	}
	else if( hOptions.exception )
	{
		console.error( "caught unhandled exception:\n" + Error.stack );
		process.exitCode = 2;

		GetStats();
	}
	else console.log( "exit code: " + Error );

	if( !isNaN( parseInt( Error ) ) && ( Error != 0 && Error != process.exitCode ) ) console.error( "ExitHandler ExitCode(" + Error + ") != process.exitCode(" + process.exitCode + ")" );
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

let g_hConfig = new Config( g_aArgs[0] || "bot" );
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

g_hClient = new Client( g_hConfig );

g_hClient.on( "connected", () =>
{
	console.info( "Connected to Discord" );
	GetStats( g_hCPUUsage, g_hMemoryUsage );
} );

g_hClient.on( "resumed", () =>
{
	console.info( "Resumed connection with Discord" );
} );

g_hClient.on( "disconnected", () =>
{
	console.info( "Disonnected from Discord" );
} );

g_hClient.on( "stream-started", ( hConnection ) =>
{
	GetStats();
} );

g_hClient.on( "stream-stopped", ( hConnection ) =>
{
	GetStats();
} );

g_hClient.on( "set-game", ( sGame ) =>
{
	GetStats( g_hCPUUsage, g_hMemoryUsage );
} );

g_hClient.Connect();
