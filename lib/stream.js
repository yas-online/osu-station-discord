"use strict";

const winston = require( "winston" );
const log = winston.loggers.get( "stream" );

const https = require( "https" );
const EventEmitter = require( "events" ).EventEmitter;

const lame = require( "lame" );
const opus = require( "node-opus" );

const discordie_constants = require( "discordie/lib/Constants" );
const AudioResampler = require( "discordie/lib/voice/AudioResampler" );

function InitDecoder()
{
	this.m_hDecoder = new lame.Decoder();

	this.m_hDecoder.on( "format", ( hFormat ) =>
	{
		if( this.m_hDecoder == null ) return;

		log.debug( "Decoder::Format()" );

		this.emit( "decoder-format", hFormat );

		this.m_hEncoder = new opus.Encoder( discordie_constants.DISCORD_SAMPLE_RATE, hFormat.channels, 60 );

		this.m_aSubscribers.forEach( ( hConnection ) =>
		{
			this.m_hEncoder.pipe( hConnection.getEncoderStream(), { end: false } );
		} );

		if( hFormat.sampleRate != discordie_constants.DISCORD_SAMPLE_RATE )
		{
			log.error( "resampling is not supported yet" );

			//this.m_hResampler = new AudioResampler( hFormat.channels, hFormat.sampleRate, discordie_constants.DISCORD_SAMPLE_RATE );
		}
		else this.m_hDecoder.pipe( this.m_hEncoder, { end: false } );
	} );
}

class Stream extends EventEmitter
{
	constructor()
	{
		log.debug( "Stream::constructor()" );

		super();

		this.m_hStream = null;

		this.m_hDecoder = null;
		this.m_hResampler = null;
		this.m_hEncoder = null;

		this.m_hEncoderOptions =
		{
			proxy: true
		};

		this.Connect.call( this );

		this.m_aSubscribers = new Set();
	}

	Shutdown()
	{
		log.debug( "Stream::Shutdown()" );

		this.Disconnect();
	}

	Connect()
	{
		log.debug( "Stream::Connect()" );

		if( this.m_hDecoder == null ) InitDecoder.call( this );

		let hGetStream = setInterval( () =>
		{
			try
			{
				let hStream = https.get( "https://radio.yas-online.net/listen/osustation", ( hResponse ) =>
				{
					this.m_hStream = hResponse;
					this.m_hStream.once( "close", () => this.Reconnect.call( this ) );
					this.m_hStream.once( "error", ( hError ) =>
					{
						log.error( hError.message );

						this.Reconnect.call( this );
					} );

					clearInterval( hGetStream );
					hGetStream = null;

					this.emit( "stream-init", this.m_hStream );

					if( this.m_hDecoder ) this.m_hStream.pipe( this.m_hDecoder, { end: false } );
				} );

				hStream.once( "aborted", () =>
				{
					log.warn( "server aborted connection" );

					if( hGetStream === null ) this.Reconnect.call( this );
				} );
				hStream.once( "close", () =>
				{
					log.info( "connection closed" );

					if( hGetStream === null ) this.Reconnect.call( this );
				} );
				hStream.once( "error", ( hError ) =>
				{
					log.error( hError.message );

					if( hGetStream === null ) this.Reconnect.call( this );
				} );
			}
			catch( hException )
			{
				log.error( hException.message );

				if( hGetStream === null ) this.Reconnect.call( this );
			}
		}, 500 );
	}

	Disconnect()
	{
		log.debug( "Stream::Disconnect()" );

		if( this.m_hStream )
		{
			this.m_hStream.unpipe();
			this.m_hStream.destroy();
			this.m_hStream = null;
		}

		if( this.m_hDecoder )
		{
			this.m_hDecoder.unpipe();
			this.m_hDecoder.destroy();
			this.m_hDecoder = null;
		}

		if( this.m_hEncoder )
		{
			this.m_hEncoder.unpipe();
			this.m_hEncoder.destroy();
			this.m_hEncoder = null;
		}

/*
		if( this.m_hResampler )
		{
			this.m_hResampler;
			this.m_hResampler = null;
		}
*/

		this.m_aSubscribers.forEach( ( hConnection ) =>
		{
			let hEncoder = hConnection.getEncoderStream();
			if( hEncoder ) hEncoder.unpipeAll();
		} );
	}

	Reconnect()
	{
		log.debug( "Reconnect()" );

		this.Disconnect();
		setTimeout( this.Connect.bind( this ), 2000 );
	}

	SetVolume( iVolume = 50 )
	{
		log.debug( "Stream::SetVolume( iVolume = " + iVolume + " )" );

		// ToDo: node-lame doesn't support setting the volume ( scale ) yet, alas mpg123_par();
		//this.m_hDecoder.volume( iVolume );
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

		if( this.m_hEncoder ) this.m_hEncoder.pipe( hStream, { end: false } );

		this.m_aSubscribers.add( hConnection );
		this.emit( "subscribed", hConnection );

		log.info( "[" + hConnection.guild.name + "] started streaming" );
	}

	Unsubscribe( hConnection )
	{
		log.debug( "Stream::Unsubscribe( hConnection = " + hConnection + " )" );

		if( !this.m_aSubscribers.has( hConnection ) ) return;

		let hStream = hConnection.getEncoderStream();
		if( hStream.writable ) hStream.end();

		let hDecoder = hConnection.getDecoder();
		if( hDecoder ) hDecoder.kill();

		let hEncoder = hConnection.getEncoder();
		if( hEncoder ) hEncoder.kill();

		this.m_aSubscribers.delete( hConnection );
		this.emit( "unsubscribed", hConnection );

		log.info( "[" + ( hConnection.guild != null ? hConnection.guild.name : hConnection.guildId ) + "] stopped streaming" );
	}
}

module.exports = Stream;
