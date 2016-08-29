"use strict";

const winston = require( "winston" );

const https = require( "https" );

let g_FileRegEx = /^(\d+)\s+(.*)\s+-\s+(.*)\.mp3$/;
let g_sGame = "";

function UpdateMetadata()
{
	if( !process.connected )
	{
		process.emit( "message", { type: "shutdown" } );

		return;
	}

	https.get( "https://radio.yas-online.net/listen/status-json.xsl", ( hResponse ) =>
	{
		let sData = "";

		hResponse.on( "data", ( hChunk ) => ( sData += hChunk ) );
		hResponse.on( "end", () =>
		{
			try
			{
				let hSource = JSON.parse( sData ).icestats.source;
				if( Array.isArray( hSource ) ) hSource = hSource.find( ( hSource ) => hSource.server_name === "osu!station" );

				if( hSource.server_name === "osu!station" )
				{
					// ToDo: fix once the stream outputs the correct format...
					if( hSource.title )
					{
						let hInfo = {};

						let hData = g_FileRegEx.exec( hSource.title );
						if( hData )
						{
							hInfo.id = parseInt( hData[1], 10 );
							hInfo.artist = hData[2];
							hInfo.title = hData[3];
						}
						else
						{
							hInfo.id = -1;
							hInfo.artist = "osu!station";
							hInfo.title = hSource.title;
						}

						hInfo.game = hInfo.title + " by " + hInfo.artist;

						if( hInfo.game !== g_sGame ) process.send( hInfo );
					}
				}
			}
			catch( hException )
			{
			}
		} );
	} );
}

let g_hInterval = null;

process.on( "message", ( hMessage ) =>
{
	switch( hMessage.type )
	{
		case "init":
			g_sGame = hMessage.game;
			UpdateMetadata();
			g_hInterval = setInterval( () => ( UpdateMetadata() ), 1000 );
		break;

		case "set-game":
			g_sGame = hMessage.game;
		break;

		case "shutdown":
			clearInterval( g_hInterval );
			g_hInterval = null;
		break;

		default:
			console.error( "metadata received invalid event" );
		break;
	}
} );
