"use strict";

const winston = require( "winston" );
const log = winston.loggers.get( "console" );

let g_aArgs = process.argv.slice( 2 );

const fs = require( "fs" );
const path = require( "path" );
const net = require( "net" );
const repl = require( "repl" );

let g_sConsoleSocket = "/tmp/osustation-discord.sock";
if( process.platform === "win32" ) g_sConsoleSocket = path.join( "\\\\.\\pipe", "osustation-discord" );
else
{
	// that's what I get for tampering with the fs module, oh well...
	try
	{
		let bExists = fs.accessSync( g_sConsoleSocket, fs.constants.F_OK );

		if( typeof bExists === "undefined" || bExists === null || bExists ) fs.unlinkSync( g_sConsoleSocket );
	}
	catch( hException )
	{
	}
}

class Console
{
	constructor( hContext = null, bCreateConsole = true )
	{
		log.debug( "Console::constructor( hContext = " + hContext + ", bCreateConsole = " + bCreateConsole + " )" );

		this.m_hConsole = null;
		this.m_hSocket = null;
		this.m_hRemoteConsole = null;

		if( bCreateConsole )
		{
			log.debug( "creating local console..." );
			this.m_hConsole = repl.start(
			{
				ignoreUndefined: true,
				replMode: repl.REPL_MODE_STRICT,
				breakEvalOnSigint: true
			} ).on( "exit", () =>
			{
				log.debug( "local console requested shutdown..." );

				process.emit( "beforeExit", 0 );
				process.emit( "exit", 0 );
			} );

			this.m_hConsole.context.app = {};
			if( hContext ) this.m_hConsole.context.app = Object.assign( this.m_hConsole.context.app, { console: this }, hContext );

			log.info( "creating remote socket..." );
			this.m_hSocket = net.createServer( ( hSocket ) =>
			{
				// ToDo: allow multiple remote consoles

				log.info( "creating remote console..." );
				this.m_hRemoteConsole = repl.start(
				{
					input: hSocket,
					output: hSocket,
					ignoreUndefined: true,
					replMode: repl.REPL_MODE_STRICT,
					breakEvalOnSigint: true
				} ).on( "exit", () =>
				{
					log.info( "closing remote console" );
				} );

				this.m_hRemoteConsole.context.app = {};
				if( hContext ) this.m_hRemoteConsole.context.app = Object.assign( this.m_hRemoteConsole.context.app, { console: this }, hContext );
			} );
			this.m_hSocket.on( "error", ( hError ) =>
			{
				log.error( hError.message );
			} );

			this.m_hSocket.listen( g_sConsoleSocket, () =>
			{
				log.info( "listening on remote socket" );
			} );
		}
		else
		{
			try
			{
				log.debug( "connecting to remote console..." );
				this.m_hSocket = net.createConnection( g_sConsoleSocket, () =>
				{
					process.stdin.pipe( this.m_hSocket );
					this.m_hSocket.pipe( process.stdout );
				} );

				this.m_hSocket.on( "close", ( bError ) =>
				{
					log.debug( "closed connection to remote console..." );

					this.Shutdown();
				} );
			}
			catch( hException )
			{
				log.error( "Failed to find remote console" );
			}
		}
	}

	Shutdown()
	{
		log.debug( "Console::Shutdown()" );

		if( this.m_hRemoteConsole )
		{
			log.debug( "Console::Shutdown(): closing remote console..." );
			this.m_hRemoteConsole.close();
			this.m_hRemoteConsole = null;
		}

		if( this.m_hSocket )
		{
			if( this.m_hSocket instanceof net.Server )
			{
				log.debug( "Console::Shutdown(): closing remote socket..." );

				this.m_hSocket.close( () =>
				{
					log.debug( "Console::Shutdown(): closed remote socket..." );

					this.m_hSocket = null;
				} );
			}
			else
			{
				log.debug( "Console::Shutdown(): closing connection to remote console..." );

				this.m_hSocket.end();
				this.m_hSocket = null;
			}
		}

		if( this.m_hConsole )
		{
			log.debug( "Console::Shutdown(): closing local console..." );

			this.m_hConsole.close();
			this.m_hConsole = null;
		}
	}

	GetLocal()
	{
		log.debug( "Console::GetLocal()" );

		return this.m_hConsole;
	}

	GetRemote()
	{
		log.debug( "Console::GetRemote()" );

		return this.m_hRemoteConsole;
	}
/*
	GetSocket()
	{
		log.debug( "Console::GetSocket()" );
		return this.m_hSocket;
	}
*/
}

module.exports = Console;
