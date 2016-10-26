"use strict";

const winston = require( "winston" );
const log = winston.loggers.get( "client" );

const EventEmitter = require( "events" ).EventEmitter;
const child = require( "child_process" );

const Stream = require( __dirname + "/stream" );

const Discordie = require( "discordie" );
const IUser = require( "discordie/lib/interfaces/IUser" );

// ToDo: can bots actually clear the entire DM channel history?
function PurgeDMs()
{
	log.debug( "PurgeDMs()" );

	this.m_hClient.DirectMessageChannels.forEach( ( hChannel ) =>
	{
		hChannel.messages.forEach( ( hMessage ) => hMessage.delete() );
	} );
}

function JoinServers( aServers )
{
	log.debug( "JoinServers( aServers = " + aServers + " )" );

	for( let hServer of aServers )
	{
		const hVoiceChannel = hServer.voiceChannels.find( ( hChannel ) =>
		{
			// might make this configureable
			return /osu\!?station/i.test( hChannel.name );
		} );

		if( hVoiceChannel )
		{
			if( !hVoiceChannel.joined )
			{
				hVoiceChannel.join( false, false ).catch( ( Error ) =>
				{
					log.warn( "[" + hServer.name + "] failed to join \"" + hVoiceChannel.name + "\": " + Error );
				} );
			}
			else
			{
				let iIndex = this.m_aJoinQueue.indexOf( hServer );
				if( iIndex > -1 )
				{
					log.debug( "[" + hServer.name + "] removing server from join queue" );
					this.m_aJoinQueue.splice( iIndex, 1 );
				}
			}
		}
		else
		{
			// ToDo: DM this message to the "manage server" users / owner?
			log.warn( "[" + hServer.name + "] Failed to find a osu!station voice channel" );
		}
	}
}

function GetVoiceConnection( sServer )
{
	log.debug( "GetVoiceConnection( sServer = " + sServer + " )" );

	if( sServer === null ) return;

	for( let hInfo of this.m_hClient.VoiceConnections )
	{
		let hVoiceConnection = hInfo.voiceConnection;
		if( hVoiceConnection && hVoiceConnection.guild.name.toLowerCase().includes( sServer.toLowerCase() ) )
		{
			return hVoiceConnection;
		}
	}
}

function OnMessage( hEvent )
{
	log.debug( "OnMessage( hEvent = " + hEvent + " )" );

	let hMessage = hEvent.message;

	if( !hMessage ) hMessage = hEvent.data;
	if( !hMessage ) return;

	const sMessage = hMessage.content;
	const hChannel = hMessage.channel;
	let hAuthor = hMessage.author;
	if( !( hAuthor instanceof IUser ) ) hAuthor = new IUser( this.m_hClient, hAuthor.id );

	// ToDo: open this up for server "manage server" users and give them non-owner specific commands...
	if( !hMessage.isPrivate || this.GetOwner().id != hAuthor.id ) return;

	const aMessageParts = sMessage.split( " " );

	// ToDo: refactor this...
	switch( aMessageParts[0] )
	{
		case "set":
			if( aMessageParts[1] == "volume" ) this.m_hStream.SetVolume( parseInt( aMessageParts[2] ) );
			else log.warn( "invalid command \"" + sMessage + "\" sent from " + hAuthor.name );
		break;

		case "start":
		case "stop":
		case "restart":
			let bStart = aMessageParts[0] === "start";
			let bRestart = aMessageParts[0] === "restart";

			if( aMessageParts[1] == "stream" )
			{
				if( aMessageParts[2] && aMessageParts[2].length > 0 )
				{
					let hConnection = GetVoiceConnection.call( this, aMessageParts[2] );

					if( hConnection )
					{
						if( bStart ) this.StartStreaming( hConnection );
						else this.StopStreaming( hConnection );
					}
					else log.warn( "couldn't find server: " + aMessageParts[2] );
				}
				else
				{
					if( bRestart )
					{
						this.m_hStream.Reconnect();
					}
					else if( bStart ) this.m_hStream.Connect();
					else this.m_hStream.Disconnect();
				}
			}
			else if( aMessageParts[1] == "streams" )
			{
				if( bRestart )
				{
					this.StopStreaming();
					this.StartStreaming();
				}
				else if( bStart ) this.StartStreaming();
				else this.StopStreaming();
			}
			else
			{
				if( bRestart )
				{
					try
					{
						this.Shutdown();

						/*const forever = require( "forever" );
						let bIsForverChild = false;

						forever.list( false, ( Error, aProcesses ) =>
						{
							for( let hProcess of aProcesses )
							{
								if( hProcess.pid === process.pid )
								{
									bIsForverChild = true;

									break;
								}
							}
						} )

						if( bIsForverChild )*/ process.kill( process.pid, "SIGUSR2" );
					}
					catch( hException )
					{
					}
				}
				else log.warn( "invalid command \"" + sMessage + "\" sent from " + hAuthor.name );
			}
		break;

		case "reconnect":
			this.Disconnect();
			this.Connect();
		break;

		case "connect":
			this.Connect();
		break;

		case "disconnect":
			this.Disconnect();
		break;

		case "shutdown":
			this.Shutdown();
		break;

		default:
			log.warn( "invalid command \"" + sMessage + "\" sent from " + hAuthor.name );
		break;
	}
}

function Init()
{
	log.debug( "Init()" );

	PurgeDMs.call( this );

	this.m_aJoinQueue = this.m_aJoinQueue.concat( this.m_hClient.Guilds.toArray() );

	JoinServers.call( this, this.m_aJoinQueue.slice() );

	if( !this.m_hJoinQueueTask )
	{
		this.m_hJoinQueueTask = setInterval( () =>
		{
			if( !this.m_aJoinQueue.length ) return;

			JoinServers.call( this, this.m_aJoinQueue.slice() );
		}, ( typeof this.m_hConfig.general === "object" && typeof this.m_hConfig.general.join_queue_interval === "number" ? this.m_hConfig.general.join_queue_interval : 10000 ) );
	}

	if( !this.m_hUpdateMetaTask )
	{
		let aExecArgs = [];
		// ToDo: automate this somehow (it would be best if child_process were smart enough to do this on it's own...)
/*
		if( process.execArgv.indexOf( "--debug-brk" ) !== -1 ) aExecArgs.push( "--debug-brk=5859" );
		else if( process.execArgv.indexOf( "--debug" ) !== -1 ) aExecArgs.push( "--debug=5859" );

		if( process.execArgv.indexOf( "--inspect" ) !== -1 ) aExecArgs.push( "--inspect=9230" );
*/
		this.m_hUpdateMetaTask = child.fork( __dirname + "/metadata", [], { execArgv: aExecArgs } );
		this.m_hUpdateMetaTask.on( "message", ( hMessage ) =>
		{
			// ToDo: do something with hMessage.id aka MapID

			this.SetGame( hMessage.game );
		} );
		this.m_hUpdateMetaTask.send( { type: "init", game: this.m_hClient.User.gameName } );
	}
}

class Client extends EventEmitter
{
	constructor( hConfig = new Config() )
	{
		log.debug( "Client::constructor( hConfig = " + hConfig + " )" );

		super();

		this.m_hConfig = hConfig;
		this.m_hOwner = null;

		this.m_aJoinQueue = [];
		this.m_hJoinQueueTask = null;

		this.m_hStream = new Stream();
		if( ( typeof this.m_hConfig.general === "object" ) && ( typeof this.m_hConfig.general.volume === "number" ) ) this.m_hStream.SetVolume( this.m_hConfig.general.volume );

		this.m_hUpdateMetaTask = null;

		this.m_hClient = new Discordie( { autoReconnect: true } );

		this.m_hClient.Dispatcher.on( "GATEWAY_READY", ( hEvent ) =>
		{
			this.emit( "connected" );

			Init.call( this );
		} );

		this.m_hClient.Dispatcher.on( "GATEWAY_RESUMED", ( hEvent ) =>
		{
			this.emit( "resumed" );

			Init.call( this );
		} );

		this.m_hClient.Dispatcher.on( "DISCONNECTED", ( hEvent ) =>
		{
			this.emit( "disconnected" );

			// Make sure everything is cleaned up before joining again...
			this.Disconnect();
		} );

		this.m_hClient.Dispatcher.on( "PRESENCE_UPDATE", ( hEvent ) =>
		{
			let hOwner = this.GetOwner();
			if( !hOwner ) return;

			if( hEvent.user.id === hOwner.id && hEvent.user !== hOwner ) this.m_hOwner = hEvent.user;
		} );

		this.m_hClient.Dispatcher.on( "GUILD_CREATE", ( hEvent ) =>
		{
			this.m_aJoinQueue.push( hEvent.guild );
			// ToDo: give "manage server" server users a first time setup upon joining a server
		} );

		let pOnMessage = OnMessage.bind( this );

		this.m_hClient.Dispatcher.on( "MESSAGE_CREATE", pOnMessage );
		this.m_hClient.Dispatcher.on( "MESSAGE_UPDATE", pOnMessage );

		this.m_hClient.Dispatcher.on( "VOICE_CONNECTED", ( hEvent ) =>
		{
			let hConnection = hEvent.voiceConnection;
			let hServer = hConnection.guild;

			log.debug( "[" + hServer.name + "] joined \"" + hConnection.channel.name + "\"" );

			let iIndex = this.m_aJoinQueue.indexOf( hServer );
			if( iIndex > -1 )
			{
				log.debug( "[" + hServer.name + "] removing server from join queue" );
				this.m_aJoinQueue.splice( iIndex, 1 );
			}

			this.StartStreaming( hConnection );
		} );

		this.m_hClient.Dispatcher.on( "VOICE_DISCONNECTED", ( hEvent ) =>
		{
			let hConnection = hEvent.voiceConnection;
			let hServer = hEvent.voiceConnection.guild;

			this.StopStreaming( hConnection );

			log.debug( "[" + hServer.name + "] left \"" + hConnection.channel.name + "\"" );

			if( !this.m_aJoinQueue.includes( hServer ) )
			{
				log.debug( "[" + hServer.name + "] adding server to join queue" );
				this.m_aJoinQueue.push( hServer );
			}
		} );
	}

	Shutdown()
	{
		log.debug( "Client::Shutdown()" );

		if( this.m_hUpdateMetaTask && this.m_hUpdateMetaTask.connected )
		{
			log.debug( "Client::Shutdown(): sending shutdown request to metadata sub-process" );

			this.m_hUpdateMetaTask.send( { type: "shutdown" } );

			this.m_hUpdateMetaTask.once( "exit", ( iCode, sSignal ) =>
			{
				// FixMe: not being triggered, meh...
				log.debug( "metadata sub-process closed" );

				this.m_hUpdateMetaTask = null;
			} );

			this.m_hUpdateMetaTask.disconnect();
		}

		if( this.m_hStream )
		{
			this.m_hStream.Shutdown();
			this.m_hStream = null;
		}

		clearInterval( this.m_hJoinQueueTask );
		this.m_hJoinQueueTask = null;

		this.Disconnect();
	}

	IsConnected()
	{
		//log.debug( "Client::IsConnected()" );

		return this.m_hClient.connected;
	}

	Connect()
	{
		log.debug( "Client::Connect()" );

		if( typeof this.m_hConfig.auth === "object" && typeof this.m_hConfig.auth.token === "string" )
		{
			log.debug( "Client::Connect(): found config auth data, connecting..." );

			this.emit( "connect" );
			this.m_hClient.connect( this.m_hConfig.auth );
		}
		else throw Error( "Failed to fetch auth config" );
	}

	Disconnect()
	{
		log.debug( "Client::Disconnect()" );

		this.m_hOwner = null;
		this.m_aJoinQueue = [];

		if( this.IsConnected() )
		{
			log.debug( "Client::Disconnect(): closing connection..." );

			this.emit( "disconnect" );

			this.SetGame();
			this.m_hClient.disconnect();
		}
	}

	GetOwner()
	{
		log.debug( "Client::GetOwner()" );

		if( typeof this.m_hOwner !== "undefined" && this.m_hOwner !== null ) return this.m_hOwner;

		if( typeof this.m_hConfig.owner === "object" )
		{
			if( typeof this.m_hConfig.owner.id === "number" ) this.m_hOwner = this.m_hClient.Users.get( this.m_hConfig.owner.id );
			else if( ( typeof this.m_hConfig.owner.username === "string" ) && ( typeof this.m_hConfig.owner.discriminator === "number" ) ) this.m_hOwner = this.m_hClient.Users.find( ( hUser ) =>
			{
				return ( hUser.username == this.m_hConfig.owner.username && hUser.discriminator == this.m_hConfig.owner.discriminator );
			} );
			// ToDo: E-Mail auth, without relying on the other fields?
			//else if( false ) return null;

			return this.m_hOwner;
		}

		return null;
	}

	SetGame( Game = null )
	{
		//log.debug( "Client::SetGame( Game = " + Game + " )" );

		if( this.IsConnected() && Game != this.m_hClient.User.gameName )
		{
			this.emit( "set-game", Game );
			this.m_hClient.User.setGame( Game );
			if( this.m_hUpdateMetaTask && this.m_hUpdateMetaTask.connected ) this.m_hUpdateMetaTask.send( { type: "set-game", game: Game } );
		}
	}

	StartStreaming( aConnections = this.m_hClient.VoiceConnections )
	{
		log.debug( "Client::StartStreaming( aConnections = " + aConnections + " )" );

		if( aConnections === null ) return;

		if( !Array.isArray( aConnections ) ) aConnections = [aConnections];

		for( let hConnection of aConnections )
		{
			if( "voiceConnection" in hConnection ) hConnection = hConnection.voiceConnection;

			this.m_hStream.Subscribe( hConnection );
		}
	}

	StopStreaming( aConnections = this.m_hClient.VoiceConnections )
	{
		log.debug( "Client::StopStreaming( aConnections = " + aConnections + " )" );

		if( aConnections === null ) return;

		if( !Array.isArray( aConnections ) ) aConnections = [aConnections];

		for( let hConnection of aConnections )
		{
			if( "voiceConnection" in hConnection ) hConnection = hConnection.voiceConnection;

			this.m_hStream.Unsubscribe( hConnection );
		}
	}
}

module.exports = Client;
