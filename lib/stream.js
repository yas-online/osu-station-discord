"use strict";

const winston = require( "winston" );
const log = winston.loggers.get( "stream" );

const https = require( "https" );
const EventEmitter = require( "events" ).EventEmitter;

const lame = require( "lame" );
const opus = require( "node-opus" );

const discordie_constants = require( "discordie/lib/Constants" );
const AudioResampler = require( "discordie/lib/voice/AudioResampler" );

function Reconnect()
{
	let hGetStream = setInterval( () =>
	{
		try
		{
			let hStream = https.get( "https://radio.yas-online.net/listen/osustation", ( hResponse ) =>
			{
				this.m_hStream = hResponse;
				this.m_hStream.on( "close", () => Reconnect.call( this ) );
				this.m_hStream.on( "error", ( hError ) =>
				{
					log.error( hError.message );

					Reconnect.call( this );
				} );

				clearInterval( hGetStream );

				this.emit( "stream-init", this.m_hStream );

				this.m_hStream.pipe( this.m_hDecoder );
			} );

			hStream.on( "aborted", () =>
			{
				log.warn( "server aborted connection" );
			} );
			hStream.on( "close", () =>
			{
				log.info( "connection closed" );
			} );
			hStream.on( "error", ( hError ) =>
			{
				log.error( hError.message );
			} );
		}
		catch( hException )
		{
			log.error( hException.message );
		}
	}, 500 );
}

class Stream extends EventEmitter
{
	constructor()
	{
		log.debug( "Stream::constructor()" );

		super();

		this.m_hStream = null;

		Reconnect.call( this );

		this.m_hDecoder = new lame.Decoder();

		this.m_hEncoderOptions =
		{
			//multiThreadedVoice: true,
			engine: "native",

			sampleRate: -1,
			channels: -1,

			float: false
		};

		this.m_hDecoder.on( "format", ( hFormat ) =>
		{
			this.emit( "decoder-format", hFormat );

			this.m_hEncoderOptions.sampleRate = hFormat.sampleRate;
			this.m_hEncoderOptions.channels = hFormat.channels;

			// new AudioResampler( hFormat.channels, hFormat.sampleRate, discordie_constants.Constants.DISCORD_SAMPLE_RATE );
			// new opus.Encoder( discordie_constants.Constants.DISCORD_SAMPLE_RATE, hFormat.channels, 60 );
		} );

		this.m_aSubscribers = new Set();
	}

	SetVolume( iVolume = 50 )
	{
		log.debug( "Stream::SetVolume( iVolume = " + iVolume + " )" );

		this.m_aSubscribers.forEach( ( hConnection ) =>
		{
			hConnection.getEncoder().setVolume( iVolume );
		} );
	}

	Subscribe( hConnection )
	{
		log.debug( "Stream::Subscribe( hConnection = " + hConnection + " )" );

		if( this.m_aSubscribers.has( hConnection ) ) return;

		if( !this.m_hStream )
		{
			setTimeout( this.Subscribe.bind( this ), 500, hConnection );
			return;
		}

		let hEncoder = hConnection.getEncoder( this.m_hEncoderOptions );
		if( !hEncoder )
		{
			log.error( "[" + hConnection.guild.name + "] Unable to get encoder" );
			return;
		}

		this.SetVolume();

		let hStream = hConnection.getEncoderStream();
		if( !hStream )
		{
			log.error( "[" + hConnection.guild.name + "] Unable to get encoder stream" );
			return;
		}

		// Stream instance is persistent until voice connection is disposed
		hStream.resetTimestamp();
		hStream.removeAllListeners( "timestamp" );

		this.m_hDecoder.pipe( hStream );

		this.m_aSubscribers.add( hConnection );
		this.emit( "subscribed", hConnection );

		log.info( "[" + hConnection.guild.name + "] started streaming" );
	}

	Unsubscribe( hConnection )
	{
		log.debug( "Stream::Unsubscribe( hConnection = " + hConnection + " )" );

		if( !this.m_aSubscribers.has( hConnection ) ) return;

		let hDecoder = hConnection.getDecoder();
		if( hDecoder ) hDecoder.kill();

		let hEncoder = hConnection.getEncoder();
		if( hEncoder ) hEncoder.kill();

		this.m_aSubscribers.delete( hConnection );
		this.emit( "unsubscribed", hConnection );

		log.info( "[" + hConnection.guild.name + "] stopped streaming" );
	}
}

module.exports = Stream;
