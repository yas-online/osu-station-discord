const child = require( "child_process" );
const https = require( "https" );
const EventEmitter = require( "events" ).EventEmitter;

const lame = require( "lame" );

const Discordie = require( "discordie" );
const IUser = require( "discordie/lib/interfaces/IUser" );

// ToDo: can bots actually clear the entire DM channel history?
function PurgeDMs( hClient )
{
	hClient.DirectMessageChannels.forEach( ( hChannel ) =>
	{
		hChannel.messages.forEach( ( hMessage ) => hMessage.delete() );
	} );
}

function JoinServers( aServers )
{
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
					console.warn( "[" + hServer.name + "] failed to join \"" + hVoiceChannel.name + "\": " + Error );
				} );
			}
			else
			{
				let iIndex = this.m_aJoinQueue.indexOf( hServer );
				if( iIndex > -1 )
				{
					console.info( "[" + hServer.name + "] removing server from join queue" );
					this.m_aJoinQueue.splice( iIndex, 1 );
				}
			}
		}
		else
		{
			// ToDo: DM this message to the "manage server" users / owner?
			console.warn( "[" + hServer.name + "] Failed to find a osu!station voice channel" );
		}
	}
}

function GetVoiceConnection( sServer )
{
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

	switch( aMessageParts[0] )
	{
		case "start":
		case "stop":
			let bStart = aMessageParts[0] === "start";

			if( aMessageParts[1] && aMessageParts[1].length > 0 )
			{
				let hConnection = GetVoiceConnection.call( this, aMessageParts[1] );

				if( hConnection )
				{
					if( bStart ) this.StartStreaming( hConnection );
					else this.StopStreaming( hConnection );
				}
				else console.warn( "couldn't find server: " + aMessageParts[1] );
			}
			else if( bStart ) this.StartStreaming();
			else this.StopStreaming();
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

		case "restart":
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
		break;

		case "shutdown":
			this.Shutdown();
		break;

		default:
			console.warn( "invalid command \"" + sMessage + "\" sent from " + hAuthor.name );
		break;
	}
}

function Init()
{
	PurgeDMs( this.m_hClient );

	this.m_aJoinQueue = this.m_aJoinQueue.concat( this.m_hClient.Guilds.toArray() );

	JoinServers.call( this, this.m_aJoinQueue.slice() );

	if( !this.m_hJoinQueueTask )
	{
		this.m_hJoinQueueTask = setInterval( () =>
		{
			if( !this.m_aJoinQueue.length ) return;

			JoinServers.call( this, this.m_aJoinQueue.slice() );
		}, 10000 );
	}

	if( !this.m_hStream )
	{
		let hGetStream = setInterval( () =>
		{
			try
			{
				https.get( "https://radio.yas-online.net/listen/osustation", ( hResponse ) =>
				{
					this.m_hStream = hResponse;
					clearInterval( hGetStream );
				} );
			}
			catch( hException )
			{
			}
		}, 500 );
		
	}

	if( !this.m_hUpdateMetaTask )
	{
		let aExecArgs = [];
		// ToDo: automate this somehow (it would be best if child_process were smart enough to do this on it's own...)
/*		let iDebugIndex = process.execArgv.indexOf( "--debug" );
		if( iDebugIndex !== -1 ) aExecArgs.push( "--debug=5859" );

		let iDebugBreakIndex = process.execArgv.indexOf( "--debug-brk" );
		if( iDebugBreakIndex !== -1 ) aExecArgs.push( "--debug-brk" );

		let iInspectIndex = process.execArgv.indexOf( "--inspect" );
		if( iInspectIndex !== -1 ) aExecArgs.push( "--inspect=9230" );
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
		super();

		this.m_hConfig = hConfig;
		this.m_hOwner = null;

		this.m_aJoinQueue = [];
		this.m_hJoinQueueTask = null;

		this.m_hStream = null;

		this.m_hStreams = {};
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

			console.info( "[" + hServer.name + "] joined \"" + hConnection.channel.name + "\"" );

			let iIndex = this.m_aJoinQueue.indexOf( hServer );
			if( iIndex > -1 )
			{
				console.info( "[" + hServer.name + "] removing server from join queue" );
				this.m_aJoinQueue.splice( iIndex, 1 );
			}

			this.StartStreaming( hConnection );
		} );

		this.m_hClient.Dispatcher.on( "VOICE_DISCONNECTED", ( hEvent ) =>
		{
			let hConnection = hEvent.voiceConnection;
			let hServer = hEvent.voiceConnection.guild;

			console.info( "[" + hServer.name + "] left \"" + hConnection.channel.name + "\"" );
/*
			if( !this.m_aJoinQueue.includes( hServer ) )
			{
				console.info( "[" + hServer.name + "] adding server to join queue" );
				this.m_aJoinQueue.push( hServer );
			}
*/
			this.StopStreaming( hConnection );
		} );
	}

	Shutdown()
	{
		if( this.m_hUpdateMetaTask && this.m_hUpdateMetaTask.connected )
		{
			this.m_hUpdateMetaTask.send( { type: "shutdown" } );

			this.m_hUpdateMetaTask.once( "exit", ( iCode, sSignal ) =>
			{
				this.m_hUpdateMetaTask = null;
			} );

			this.m_hUpdateMetaTask.disconnect();
		}

		this.m_hStream = null;

		clearInterval( this.m_hJoinQueueTask );
		this.m_hJoinQueueTask = null;

		this.Disconnect();
	}

	IsConnected()
	{
		return this.m_hClient.connected;
	}

	Connect()
	{
		this.emit( "connect" );

		if( typeof this.m_hConfig.auth === "object" && typeof this.m_hConfig.auth.token === "string" ) this.m_hClient.connect( this.m_hConfig.auth );
		else throw Error( "Failed to fetch auth config" );
	}

	Disconnect()
	{
		this.StopStreaming();

		this.m_hOwner = null;
		this.m_aJoinQueue = [];

		this.m_hStreams = {};

		if( this.IsConnected() )
		{
			this.emit( "disconnect" );

			this.SetGame();
			this.m_hClient.disconnect();
		}
	}

	GetOwner()
	{
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
		if( this.IsConnected() && Game != this.m_hClient.User.gameName )
		{
			this.emit( "set-game", Game );
			this.m_hClient.User.setGame( Game );
			if( this.m_hUpdateMetaTask && this.m_hUpdateMetaTask.connected ) this.m_hUpdateMetaTask.send( { type: "set-game", game: Game } );
		}
	}

	// ToDo: doing a "stop" and a "start" results in music only playing for 1 second...
	StartStreaming( aConnections = this.m_hClient.VoiceConnections )
	{
		if( aConnections === null ) return;

		if( !Array.isArray( aConnections ) ) aConnections = [aConnections];

		for( let hConnection of aConnections )
		{
			if( "voiceConnection" in hConnection ) hConnection = hConnection.voiceConnection;

			if( hConnection.guildId in this.m_hStreams ) return;

			if( !this.m_hStream )
			{
				setTimeout( StartStream, 2000, hConnection );
				return;
			}

			this.emit( "stream-start", hConnection );

			let hDecoder = new lame.Decoder();

			hDecoder.on( "format", ( hFormat ) =>
			{
				let hEncoderOptions =
				{
					multiThreadedVoice: true,
					//engine: "native",
					frameDuration: 60,
					sampleRate: hFormat.sampleRate,
					channels: hFormat.channels,
					float: false
				};

				let hEncoder = hConnection.getEncoder( hEncoderOptions );
				if( !hEncoder )
				{
					console.error( "[" + hConnection.guild.name + "] Unable to get encoder" );
					return;
				}

				if( ( typeof this.m_hConfig.general === "object" ) && ( typeof this.m_hConfig.general.volume === "number" ) ) hEncoder.setVolume( this.m_hConfig.general.volume );
				else hEncoder.setVolume( 50 );

				let hStream = hEncoder._stream;
				if( !hStream )
				{
					console.error( "[" + hConnection.guild.name + "] Unable to get encoder stream" );
					return;
				}

				// Stream instance is persistent until voice connection is disposed
				hStream.resetTimestamp();
				hStream.removeAllListeners( "timestamp" );
				hDecoder.pipe( hStream );

				this.m_hStreams[hConnection.guildId] = { connection: hConnection, decoder: hDecoder };
				console.info( "[" + hConnection.guild.name + "] started streaming" );
				this.emit( "stream-started", this.m_hStreams[hConnection.guildId] );
			} );

			this.m_hStream.pipe( hDecoder );
		}
	}

	StopStreaming( aConnections = this.m_hClient.VoiceConnections )
	{
		if( aConnections === null ) return;

		if( !Array.isArray( aConnections ) ) aConnections = [aConnections];

		for( let hConnection of aConnections )
		{
			if( "voiceConnection" in hConnection ) hConnection = hConnection.voiceConnection;

			if( !( hConnection.guildId in this.m_hStreams ) ) return;

			let hStream = this.m_hStreams[hConnection.guildId];

			console.info( "[" + hConnection.guild.name + "] stop streaming" );
			this.emit( "stream-stop", hStream );


			hStream.decoder.unpipe();

			let hDecoder = hConnection.getDecoder();
			if( hDecoder ) hDecoder.kill();

			let hEncoder = hConnection.getEncoder();
			if( hEncoder ) hEncoder.kill();

			delete this.m_hStreams[hConnection.guildId];

			this.emit( "stream-stopped", hStream );
		}
	}
}

module.exports = Client;
