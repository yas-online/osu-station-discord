"use strict";

const chai = require( "chai" );
const should = chai.should();

const child = require( "child_process" );

describe( "Metadata", function()
{
	let hChild = null;

	before( function()
	{
		hChild = child.fork( __dirname + "/../lib/metadata", [], { execArgv: [] } );
	} );

	it( "should retrive metadata from the sub-process", function( pDone )
	{
		hChild.once( "message", ( hMessage ) =>
		{
			hMessage.should.be.a( "object" );

			hMessage.should.have.property( "id" );
			hMessage.id.should.be.a( "number" );

			hMessage.should.have.property( "artist" );
			hMessage.artist.should.be.a( "string" );

			hMessage.should.have.property( "title" );
			hMessage.title.should.be.a( "string" );

			hMessage.should.have.property( "game" );
			hMessage.game.should.be.a( "string" );
			hMessage.game.should.be.equal( hMessage.title + " by " + hMessage.artist );

			pDone();
		} );

		hChild.send( { type: "init", game: null } ).should.be.true;
	} );

	it( "should shutdown the sub-process gracefully", function( pDone )
	{
		if( hChild && hChild.connected )
		{
			hChild.send( { type: "shutdown" } );

			hChild.once( "exit", ( iCode, sSignal ) =>
			{
				iCode.should.exist;
				iCode.should.be.a( "number" );
				iCode.should.be.equal( 0 );

				should.not.exist( sSignal );

				hChild = null;

				pDone();
			} );

			hChild.disconnect();
		}
	} );
} );
