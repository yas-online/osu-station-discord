const EventEmitter = require( "events" );
const https = require( "https" );
const util = require( "util" );

const lame = require( "lame" );

const Discordie = require( "discordie" );
const IUser = require( "discordie/lib/interfaces/IUser" );

function JoinServers( hServers )
{
	for( let hServer of hServers )
	{
		const hVoiceChannel = hServer.voiceChannels.find( ( hChannel ) =>
		{
			// might make this configureable
			return ( hChannel.name == "osu!station" || hChannel.name == "osustation" )
		} );

		if( hVoiceChannel )
		{
			hVoiceChannel.join( false, false ).then( ( hInfo ) =>
			{
				console.error( "joined \"" + hVoiceChannel.name + "\" on \"" + hServer.name + "\"" );
			} ).catch( ( Error ) =>
			{
				console.error( "Failed to join \"" + hVoiceChannel.name + "\" on \"" + hServer.name + "\": " + Error );
			} );
		}
		else console.error( "Failed to find a osu!station voice channel on \"" + hServer.name + "\"" );
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

	if( !hMessage.isPrivate || this.GetOwner() != hAuthor ) return;

	const sMessageParts = sMessage.split( " " );

	switch( sMessageParts[0] )
	{
/*		case "start":
			this.StartStreaming();
		break;

		case "stop":
			this.StopStreaming();
		break;
*/
		case "restart":
		case "reconnect":
			this.Disconnect();
			this.Connect();
		break;

		case "disconnect":
		case "shutdown":
			this.Disconnect();
		break;

		default:
			console.warn( "invalid command sent" );
		break;
	}
}

class Client /*extends EventEmitter*/
{
	constructor( hConfig = new Config() )
	{
		this.m_hConfig = hConfig;
		this.m_hOwner = null;

		this.m_hUpdateMetaTask = null;
		this.m_hStreams = {};

		this.m_hClient = new Discordie( { autoReconnect: true } );

		this.m_hClient.Dispatcher.onAny( ( sType, hEvent ) =>
		{
			let aIgnoreTypes =
			[
				"REQUEST_GATEWAY_SUCCESS",

				"GATEWAY_OPEN",
				"GATEWAY_DISCONNECT",

				"GATEWAY_HELLO",
				"GATEWAY_READY",
				"ANY_GATEWAY_READY",
				"GATEWAY_DISPATCH",

				"COLLECTION_READY",
				"READY_TASK_FINISHED",

				"READY",
				"PRESENCE_UPDATE",

				"TYPING_START",
				"MESSAGE_CREATE",
				"MESSAGE_UPDATE",
				"MESSAGE_DELETE",

				"VOICE_CHANNEL_JOIN",
				"VOICE_CHANNEL_LEAVE",
				"VOICESOCKET_OPEN",
				"VOICESOCKET_DISCONNECT",
				"VOICE_READY",
				"VOICE_CONNECTED",
				"VOICE_DISCONNECTED",
				"VOICE_SESSION_DESCRIPTION",
			];

			if( aIgnoreTypes.find( ( sIgnoreType ) => ( sIgnoreType == sType || sIgnoreType == hEvent.type ) ) ) return console.log( "<" + sType + ">" );

			console.log( "\nEvent: " + sType );
			console.log( "Args: " + JSON.stringify( hEvent ) );
		} );

		this.m_hClient.Dispatcher.on( "GATEWAY_READY", ( hEvent ) =>
		{
			let hServers = this.m_hClient.Guilds;
			JoinServers.call( this, hServers );

			this.UpdateMetadata();
			this.m_hUpdateMetaTask = setInterval( () => ( this.UpdateMetadata() ), 1000 );
		} );

		this.m_hClient.Dispatcher.on( "GUILD_CREATE", ( hEvent ) =>
		{
			JoinServers.call( this, [hEvent.guild] );
		} );

		let pOnMessage = OnMessage.bind( this );

		this.m_hClient.Dispatcher.on( "MESSAGE_CREATE", pOnMessage );
		this.m_hClient.Dispatcher.on( "MESSAGE_UPDATE", pOnMessage );

		this.m_hClient.Dispatcher.on( "VOICE_CONNECTED", ( hEvent ) =>
		{
			this.StartStreaming( hEvent.voiceConnection );
		} );
	}

	UpdateMetadata()
	{
		https.get( "https://radio.yas-online.net/listen/status-json.xsl", ( hResponse ) =>
		{
			let sData = "";

			hResponse.on( "data", ( hChunk ) => ( sData += hChunk ) );
			hResponse.on( "end", () =>
			{
				let hSource = JSON.parse( sData ).icestats.source;
				if( Array.isArray( hSource ) ) hSource = hSource.find( ( hSource ) => hSource.server_name === "osu!station" );

				// ToDo: fix once the stream outputs the correct format...
				if( hSource.title )
				{
					let hInfo = hSource.title.match( /^(\d+)\s+(.*)\s+-\s+(.*)\.mp3$/ );

					if( hInfo ) this.SetGame( hInfo[3] + " by " + hInfo[2] );
					else this.SetGame( hInfo[1] + " by osu!station" );
				}
			} );
		} );
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
			//else if( false ) return null;
		}

		return this.m_hOwner;
	}

	IsConnected()
	{
		return this.m_hClient.connected;
	}

	Connect()
	{
		if( typeof this.m_hConfig.auth === "object" && typeof this.m_hConfig.auth.token === "string" ) this.m_hClient.connect( this.m_hConfig.auth );
		else throw Error( "Failed to fetch auth config" );
	}

	Disconnect()
	{
		clearInterval( this.m_hUpdateMetaTask );
		this.SetGame();

		this.m_hClient.disconnect();
	}

	SetGame( Game = null )
	{
		if( Game != this.m_hClient.User.gameName ) this.m_hClient.User.setGame( Game );
	}

	StartStreaming( aConnections = this.m_hClient.VoiceConnections )
	{
		if( !Array.isArray( aConnections ) ) aConnections = [aConnections];

		for( let hConnection of aConnections )
		{

			if( "voiceConnection" in hConnection ) hConnection = hConnection.voiceConnection;

			if( hConnection.guildId in this.m_hStreams ) return;

			https.get( "https://radio.yas-online.net/listen/osustation", ( hResponse ) =>
			{
				let hDecoder = new lame.Decoder();

				hDecoder.on( "format", hFormat =>
				{
					// note: discordie encoder does resampling if rate != 48000
					let hOptions =
					{
						frameDuration: 60,
						sampleRate: hFormat.sampleRate,
						channels: hFormat.channels,
						float: false
					};

					let hEncoder = hConnection.getEncoder( hOptions );
					if( !hEncoder )
					{
						console.error( "Unable to get encoder, connection is disposed" );
						return;
					}

					if( typeof this.m_hConfig.general === "object" && typeof this.m_hConfig.general.volume === "string" ) hEncoder.setVolume( this.m_hConfig.general.volume );
					else hEncoder.setVolume( 50 );

					let hStream = hEncoder._stream;
					if( !hStream )
					{
						console.error( "Unable to get encoder, connection is disposed" );
						return;
					}

					// Stream instance is persistent until voice connection is disposed;
					// you can register timestamp listener once when connection is initialized
					// or access timestamp with `hStream.timestamp`
					hStream.resetTimestamp();
					hStream.removeAllListeners( "timestamp" );
//					hStream.on( "timestamp", iTime => console.log( "Time: " + iTime ) );

					// only 1 stream at a time can be piped into AudioEncoderStream
					// previous stream will automatically unpipe
					hDecoder.pipe( hStream );
					hDecoder.once( "end", () =>
					{
						hStream.resetTimestamp();
						hDecoder.pipe( hStream );
					} );
					hStream.once( "unpipe", () => hResponse.destroy() );

					this.m_hStreams[hConnection.guildId] = { connection: hConnection, encoder: hEncoder, decoder: hDecoder };
				} );

				hResponse.pipe( hDecoder );
			} );
		}
	}

	/*StopStreaming( aServers = this.m_hClient.Guilds.toArray() )
	{
		if( !Array.isArray( aServers ) ) aServers = [aServers];

		for( let hServer of aServers )
		{
			if( hServer.id in this.m_hStreams )
			{
				let hStream = this.m_hStreams[hServer.id];

				hStream.encoder.kill();
				hStream.decoder.unpipe();
				//hStream.connection.disconnect();

				delete this.m_hStreams[hServer.id];
			}
		}
	}*/
}

module.exports = Client;
