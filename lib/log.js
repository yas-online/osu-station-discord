"use strict";

const fs = require( "fs" );
const path = require( "path" );

let g_sLogDir = path.resolve( __dirname + "/../log" );
try
{
	fs.mkdirSync( g_sLogDir );
}
catch( hException )
{
}

function GetTimestamp()
{
	let hDate = new Date();
	let iTimeZone = hDate.getTimezoneOffset() / 60;

	return ( ( "0" + hDate.getDate() ).slice( -2 ) + "." + ( "0" + ( hDate.getMonth() + 1 ) ).slice( -2 ) + "." + hDate.getFullYear() + " - " + ( "0" + hDate.getHours() ).slice( -2 ) + ":" + ( "0" + hDate.getMinutes() ).slice( -2 ) + ":" + ( "0" + hDate.getSeconds() ).slice( -2 ) + ( process.env.DEBUG ? ":" + ( "00" + hDate.getMilliseconds() ).slice( -3 ) : "" ) + " UTC" + ( iTimeZone >= 0 ? "+" : "" ) + iTimeZone );
}

function FormatLog( hOptions )
{
	// only console transports have a align property, hack it in for the rest...
	if( typeof hOptions.align === "undefined" ) hOptions.align = true;

	let sLog = "";

	if( hOptions.timestamp ) sLog += "[" + ( typeof hOptions.timestamp === "function" ? hOptions.timestamp() : hOptions.timestamp ) + "]";
	if( hOptions.showLevel )
	{
		let sLevel = hOptions.level;
		sLevel = sLevel[0].toUpperCase() + sLevel.slice( 1 );

		sLog += ( hOptions.timestamp ? ( hOptions.align ? "\t" : " " ) : "" ) + "[" + ( hOptions.colorize === "all" || hOptions.colorize === "level" || hOptions.colorize === true ? winston.config.colorize( hOptions.level, sLevel ) : sLevel ) + "]";
	}
	// ToDo: find a better align method then hardcoded 6 / 7 numbers
	if( hOptions.label ) sLog += ( hOptions.timestamp || hOptions.showLevel ? ( hOptions.align ? ( hOptions.showLevel && hOptions.level.length < 6 ? "\t\t" : "\t" ) : " " ) : "" ) + hOptions.label;
	if( hOptions.timestamp || hOptions.showLevel || hOptions.label ) sLog += ":" + ( hOptions.align ? ( hOptions.label && hOptions.label.length < 7 ? "\t\t" : "\t" ) : " " );
	sLog += ( hOptions.colorize === "all" || hOptions.colorize === "message" ? winston.config.colorize( hOptions.level, hOptions.message ) : ( !hOptions.colorize ? hOptions.message.replace( /\u001b\[(\d+(;\d+)*)?m/g, "" ) : hOptions.message ) );

	// ToDo: meta

	return sLog;
}

const winston = require( "winston" );
winston.config.allColors["verbose"] = "magenta";
winston.config.allColors["debug"] = "cyan";

// Instead of using the "colors/safe" package, we'll just get the levels that match the color name to pass it to winston.config.colorize()
function FindLevelsbyColor( sColor )
{
	let aLevels = [];

	for( let sLevel in winston.config.allColors )
	{
		if( winston.config.allColors[sLevel] === sColor ) aLevels.push( sLevel );
	}

	if( aLevels.length === 0 ) aLevels.push( "info" );

	return aLevels;
}

class LoggerProfile
{
	constructor( hLogger, hOptions = { slow_timeout: 50, level: "info", message: null } )
	{
		this.m_hLogger = hLogger;
		this.m_iStartTime = process.hrtime();
		this.m_iLastTime = -1;

		this.m_iSlowTimeout = hOptions.slow_timeout;
		this.m_sLevel = hOptions.level;
		this.m_sMessage = ( hOptions.message ? hOptions.message : hLogger.name );
	}

	Elapsed( sMessage = null, sLevel = null )
	{
		if( this.m_iStartTime !== -1 )
		{
			this.m_iLastTime = process.hrtime( ( this.m_iLastTime === -1 ? this.m_hStartTime : this.m_iLastTime ) );

			// this.m_iLastTime[1] is in nanoseconds, convert to milliseconds
			let iMilliseconds = this.m_iLastTime[1] / ( 1000 * 1000 );
			let sMilliseconds = iMilliseconds.toPrecision( 3 ) + " ms";

			this.m_hLogger.log( ( this.m_sLevel ? this.m_sLevel : sLevel ), ( this.m_sMessage ? this.m_sMessage : sMessage ) +
				" (" +
					( this.m_iSlowTimeout >= 0 ?
						( iMilliseconds <= ( this.m_iSlowTimeout / 2 ) ?
							winston.config.colorize( FindLevelsbyColor( "green" )[0], sMilliseconds )
						:
							( iMilliseconds <= this.m_iSlowTimeout ?
								winston.config.colorize( FindLevelsbyColor( "yellow" )[0], sMilliseconds )
							:
								winston.config.colorize( FindLevelsbyColor( "red" )[0], sMilliseconds )
							)
						)
					:
						sMilliseconds
					) +
				")" );
		}
	}

	Stop( sMessage = null, sLevel = null )
	{
		this.Elapsed( sMessage, sLevel );

		this.m_iStartTime = -1;
		this.m_iLastTime = -1;
	}
}

winston.Logger.prototype.startTimer = function( iSlowTimeout = 50, sLevel = "info", sMessage = null )
{
	return new LoggerProfile( this, { slow_timeout: iSlowTimeout, level: sLevel, message: sMessage } );
}

winston.Logger.prototype.profile = function( sID, iSlowTimeout = 50, sLevel = "info", sMessage = null )
{
	if( !this.profilers[sID] ) this.profilers[sID] = new LoggerProfile( this, { slow_timeout: iSlowTimeout, level: sLevel, message: ( sMessage ? sMessage : sID ) } );
	else
	{
		this.profilers[sID].Stop( sMessage, sLevel );
		delete this.profilers[sID];
	}
}

let g_hLogFileOptions = { json: false, timestamp: GetTimestamp, formatter: FormatLog, maxsize: 5 * ( 1024 * 1024 ), maxFiles: 3, tailable: true, zippedArchive: true };

let g_aLogTransports =
[
	{ type: winston.transports.Console, options: { name: "default-console", level: ( process.env.DEBUG ? "debug" : "info" ), stderrLevels: ["error"], colorize: true, align: true, timestamp: GetTimestamp, formatter: FormatLog, prettyPrint: true } },
	{ type: winston.transports.File, options: Object.assign( {}, g_hLogFileOptions, { name: "default-file", level: "info", filename: g_sLogDir + "/default.log" } ) }
];

winston.remove( winston.transports.Console );
g_aLogTransports.forEach( ( hTransport ) => winston.add( hTransport.type, hTransport.options ) );
if( process.env.DEBUG ) winston.add( winston.transports.File, Object.assign( {}, g_hLogFileOptions, { name: "debug-file", level: "debug", filename: g_sLogDir + "/debug.log" } ) );

function GenerateLogTransports( hOptions )
{
	let aTransports = [];

	g_aLogTransports.forEach( ( hTransport ) => aTransports.push( new ( hTransport.type ) ( Object.assign( {}, hTransport.options, hOptions, { name: ( hOptions.name ? hOptions.name + "-" : "" ) + hTransport.type.name } ) ) ) );
	if( process.env.DEBUG ) aTransports.push( new ( winston.transports.File ) ( Object.assign( {}, g_hLogFileOptions, hOptions, { name: "debug-file", level: "debug", filename: g_sLogDir + "/debug.log" } ) ) );

	return { transports: aTransports };
}

winston.loggers.add( "main", GenerateLogTransports( { filename: g_sLogDir + "/main.log", label: "Main" } ) );
winston.loggers.add( "console", GenerateLogTransports( { filename: g_sLogDir + "/console.log", label: "Console" } ) );
winston.loggers.add( "client", GenerateLogTransports( { filename: g_sLogDir + "/client.log", label: "Client" } ) );
winston.loggers.add( "stream", GenerateLogTransports( { filename: g_sLogDir + "/stream.log", label: "Stream" } ) );

/*
	Override default console functions
*/

console.debug = winston.debug;
console.verbose = winston.verbose;
console.log = winston.log;
console.info = winston.info;
console.warn = winston.warn;
console.error = winston.error;

if( !( "_assert" in console ) )
{
	console._assert = console.assert;
	console.assert = ( Assertion, sMessage, ...Args ) =>
	{
		try
		{
			console._assert( Assertion, message, ...Args );
		}
		catch( hException )
		{
			winston.error( hException.stack );
		}
	}
}

//console.dir
//console.time
//console.TimeEnd
//console.trace
