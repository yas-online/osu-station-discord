"use strict";

const https = require( "https" );

// ToDo: this child-process seems to leak memory over time, not much, so it's probably a string?

let g_sGame = "";
let g_hInterval = null;

process.on( "message", ( hMessage ) =>
{
	g_sGame = hMessage.game;
} );

function UpdateMetadata()
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
				let hInfo = { id: -1, artist: "osu!station", title: hSource.title, game: "" };

				let hData = /^(\d+)\s+(.*)\s+-\s+(.*)\.mp3$/.exec( hSource.title );
				if( hData )
				{
					hInfo.id = parseInt( hData[1], 10 );
					hInfo.artist = hData[2];
					hInfo.title = hData[3];
				}

				hInfo.game = hInfo.title + " by " + hInfo.artist;

				if( hInfo.game !== g_sGame && process.connected ) process.send( hInfo );
			}
		} );
	} );

	if( !process.connected ) clearInterval( g_hInterval );
}

UpdateMetadata();
g_hInterval = setInterval( () => ( UpdateMetadata() ), 1000 );
