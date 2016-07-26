"use strict";

const chai = require( "chai" );
const should = chai.should();

const child = require( "child_process" );

describe( "Metadata", function()
{
	let hChild = null;

	before( function()
	{
		hChild = child.fork( __dirname + "/../lib/metadata" );
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

			pDone();
		} );

		hChild.send( { Game: null } ).should.be.true;
	} );

	it( "should shutdown the sub-process gracefully", function( pDone )
	{
		hChild.once( "exit", ( iCode, sSignal ) =>
		{
			iCode.should.exist;
			iCode.should.be.a( "number" );
			iCode.should.be.equal( 0 );

			should.not.exist( sSignal );

			pDone();
		} );

		hChild.disconnect();
	} );
} );
