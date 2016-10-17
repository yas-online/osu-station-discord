"use strict";

const chai = require( "chai" );
const should = chai.should();
chai.use( require( "chai-string" ) );
chai.use( require( "chai-fs" ) );

const fs = require( "fs" );
const path = require( "path" );
const os =  require( "os" );

const g_sConfigPath = path.resolve( __dirname + "/cfg" );
const Config = require( __dirname + "/../lib/config" );

function CreateTestConfig( sTestCategory, sTestName, TestValue = true, bTestComments = false )
{
	let sContents = "";

	if( bTestComments ) sContents += "" +
	"/*" + os.EOL +
	"	Testing multi-line comments is a grand thing" + os.EOL +
	"*/" + os.EOL;

	sContents += "" +
	"{" + os.EOL;

	if( bTestComments ) sContents += "" +
	"	// Add a unique value to make sure the tests get the right file" + os.EOL;

	sContents += "" +
	"	\"" + sTestCategory + "\":" + os.EOL +
	"	{" + os.EOL +
	"		\"" + sTestName + "\": " + TestValue.toString() + os.EOL +
	"	}" + os.EOL +
	"}" + os.EOL;
	return sContents;
}

describe( "Config", function()
{
	let cfg = null;

	before( function()
	{
		Config.SetPath( g_sConfigPath );
	} );

	afterEach( function()
	{
		cfg = null;
	} );

	/*
		Class tests
	*/
	describe( "Class", function()
	{
		describe( "initialization", function()
		{
			before( function()
			{
				cfg = new Config();
			} );

			it( "should create new Config Object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				cfg.should.be.a.instanceof( Config );

				( __dirname + "/cfg/default.json" ).should.be.a.file;
			} );
		} );

		describe( "call", function()
		{
			before( function()
			{
				cfg = Config;
			} );

			it( "shouldn't allow calling the Config class as function", function()
			{
				should.exist( cfg );
				should.throw( function()
				{
					cfg();
				}, Error, "Class constructor Config cannot be invoked without 'new'" );
			} );
		} );
	} );

	/*
		Constructor file param tests
	*/
	describe( "constructor file param", function()
	{
		before( function()
		{
			fs.writeFileSync( path.join( g_sConfigPath, "default.json" ), CreateTestConfig( "constructor", "test1" ) );
			fs.writeFileSync( path.join( g_sConfigPath, "test.json" ), CreateTestConfig( "constructor", "test2" ) );
			fs.writeFileSync( path.join( g_sConfigPath, "test.cfg" ), CreateTestConfig( "constructor", "test3" ) );

			try
			{
				fs.mkdirSync( path.join( g_sConfigPath, "Test" ) );
			}
			catch( hException )
			{
			}

			fs.writeFileSync( path.join( g_sConfigPath, "Test", "test.json" ), CreateTestConfig( "constructor", "test4" ) );
		} );

		after( function()
		{
			fs.unlinkSync( path.join( g_sConfigPath, "default.json" ) );
			fs.unlinkSync( path.join( g_sConfigPath, "test.json" ) );
			fs.unlinkSync( path.join( g_sConfigPath, "test.cfg" ) );
			fs.unlinkSync( path.join( g_sConfigPath, "Test", "test.json" ) );
			fs.rmdirSync( path.join( g_sConfigPath, "Test" ) );
		} );

		describe( "constructor()", function()
		{
			before( function()
			{
				cfg = new Config();
			} );

			it( "should read default.json inside the cfg sub-folder into config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.constructor );
				cfg.constructor.should.be.a( "object" );

				cfg.constructor.should.have.property( "test1" );
				cfg.constructor.test1.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "constructor.test1" );
			} );
		} );

		describe( "constructor( sFile = null )", function()
		{
			before( function()
			{
				cfg = new Config( null );
			} );

			it( "should read default.json inside the cfg sub-folder into config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.constructor );
				cfg.constructor.should.be.a( "object" );

				cfg.constructor.should.have.property( "test1" );
				cfg.constructor.test1.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "constructor.test1" );
			} );
		} );

		describe( "constructor( sFile = \"test\" )", function()
		{
			before( function()
			{
				cfg = new Config( "test" );
			} );

			it( "should read test.json inside the cfg sub-folder into config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/test.json" ).should.be.a.file;

				should.exist( cfg.constructor );
				cfg.constructor.should.be.a( "object" );

				cfg.constructor.should.have.property( "test2" );
				cfg.constructor.test2.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "constructor.test2" );
			} );
		} );

		describe( "constructor( sFile = \"test.cfg\" )", function()
		{
			before( function()
			{
				cfg = new Config( "test.cfg" );
			} );

			it( "should read test.cfg inside the cfg sub-folder into config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/test.cfg" ).should.be.a.file;

				should.exist( cfg.constructor );
				cfg.constructor.should.be.a( "object" );

				cfg.constructor.should.have.property( "test3" );
				cfg.constructor.test3.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "constructor.test3" );
			} );
		} );

		describe( "constructor( sFile = \"Test/test\" )", function()
		{
			before( function()
			{
				cfg = new Config( "Test/test" );
			});

			it( "should read test.json inside the cfg/Test sub-folder into config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/Test/test.json" ).should.be.a.file;

				should.exist( cfg.constructor );
				cfg.constructor.should.be.a( "object" );

				cfg.constructor.should.have.property( "test4" );
				cfg.constructor.test4.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "constructor.test4" );
			} );
		} );
	} );

	/*
		Constructor default content param tests
	*/
	describe( "constructor default content param", function()
	{
		afterEach( function()
		{
			let sPath = path.join( g_sConfigPath, "default.json" );
			if( fs.existsSync( sPath ) ) fs.unlinkSync( sPath );
		} );

		describe( "constructor()", function()
		{
			before( function()
			{
				fs.writeFileSync( path.join( g_sConfigPath, "default.json" ), CreateTestConfig( "exists", "test1" ) );

				cfg = new Config( null, CreateTestConfig( "not_exists", "test2" ) );
			} );

			it( "should create default.json inside the cfg sub-folder only if file doesn't exist already", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.exists );
				cfg.exists.should.be.a( "object" );

				cfg.exists.should.have.property( "test1" );
				cfg.exists.test1.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "default.test1" );
			} );
		} );

		describe( "constructor( sFile = null, DefaultContent = \"<config contents>\" )", function()
		{
			before( function()
			{
				cfg = new Config( null, CreateTestConfig( "default", "test1" ) );
			} );

			it( "should create default.json (from string) inside the cfg sub-folder and push it's contents into the config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.default );
				cfg.default.should.be.a( "object" );

				cfg.default.should.have.property( "test1" );
				cfg.default.test1.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "default.test1" );
			} );
		} );

		describe( "constructor( sFile = null, DefaultContent = \"<config contents with comments>\" )", function()
		{

			before( function()
			{
				cfg = new Config( null, CreateTestConfig( "default", "test2", true, true ) );
			} );

			it( "should create default.json (from string with comments) inside the cfg sub-folder and push it's contents into the config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.default );
				cfg.default.should.be.a( "object" );

				cfg.default.should.have.property( "test2" );
				cfg.default.test2.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "default.test2" );
			} );
		} );

		describe( "constructor( sFile = null, DefaultContent = { default: { test3: true } } )", function()
		{
			before( function()
			{
				cfg = new Config( null, { default: { test3: true } } );
			} );

			it( "should create default.json (from object) inside the cfg sub-folder and push it's contents into the config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.default );
				cfg.default.should.be.a( "object" );

				cfg.default.should.have.property( "test3" );
				cfg.default.test3.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "default.test3" );
			} );
		} );

		describe( "constructor(); CreateDefaultConfig( \"<config contents>\" )", function()
		{
			before( function()
			{
				cfg = new Config( null );
			} );

			it( "should create default.json (using CreateDefaultConfig) inside the cfg sub-folder and push it's contents into the config object", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				cfg.CreateDefaultConfig( CreateTestConfig( "default", "test4" ) );

				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.default );
				cfg.default.should.be.a( "object" );

				cfg.default.should.have.property( "test4" );
				cfg.default.test4.should.be.true;

				// this ain't working for shit, blame should.js...
				//cfg.should.have.deep.property( "default.test4" );
			} );
		} );
	} );

	/*
		Accessor tests
	*/
	describe( "Accessor", function()
	{
		before( function()
		{
			fs.writeFileSync( path.join( g_sConfigPath, "default.json" ), CreateTestConfig( "accessor", "test" ) );
		} );

		after( function()
		{
			fs.unlinkSync( path.join( g_sConfigPath, "default.json" ) );
		} );

		describe( "array read access", function()
		{
			before( function()
			{
				cfg = new Config();
			} );

			it( "should read default.json and fetch a value via array operator", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg["accessor"] );
				cfg["accessor"].should.be.a( "object" );
				cfg["accessor"]["test"].should.be.true;
			} );
		} );

		describe( "array write access", function()
		{
			before( function()
			{
				cfg = new Config();
			} );

			it( "shouldn't allow write access via array operator", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg["accessor"] );
				cfg["accessor"].should.be.a( "object" );
				should.exist( cfg["accessor"]["test"] );
				cfg["accessor"]["test"].should.be.true;

				should.throw( function()
				{
					cfg["accessor"] = false;
				}, Error, "write access to object denied" );
				cfg["accessor"].should.a( "object" );

				cfg["accessor"]["test"] = false;
				cfg["accessor"]["test"].should.be.true;
			} );
		} );

		describe( "property read access", function()
		{
			before( function()
			{
				cfg = new Config();
			} );

			it( "should read default.json and fetch a value via property operator", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.accessor );
				cfg.accessor.should.be.a( "object" );
				cfg.accessor.test.should.be.true;
			} );
		} );

		describe( "property write access", function()
		{
			before( function()
			{
				cfg = new Config();
			} );

			it( "shouldn't allow write access via property operator", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.accessor );
				cfg.accessor.should.be.a( "object" );
				should.exist( cfg.accessor.test );
				cfg.accessor.test.should.be.true;

				should.throw( function()
				{
					cfg.accessor = false;
				}, Error, "write access to object denied" );
				cfg.accessor.should.a( "object" );

				cfg.accessor.test = false;
				cfg.accessor.test.should.be.true;
			} );
		} );
	} );

	/*
		ExpandString tests
	*/
	describe( "ExpandString (WIP, need to work on the internal config object first...)", function()
	{
/*		before( function()
		{
			process.env.TEST = "test";

			cfg = new Config( null, "" +
			"{" + os.EOL +
			"	\"expand\":" + os.EOL +
			"	{" + os.EOL +
			"		\"test\": true," + os.EOL +
			"		\"test2\": \"$ENV:TEST\"," + os.EOL +
			"		\"test3\": \"$platform\"" + os.EOL +
			"	}" + os.EOL +
			"}" + os.EOL );
		} );

		after( function()
		{
			fs.unlinkSync( path.join( g_sConfigPath, "default.json" ) );
		} );

		describe( "expand key", function()
		{
			before( function()
			{
				cfg = new Config();
			} );

			it( "should read default.json and fetch an value from a expanded key", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.expand );
				cfg.expand.should.be.a( "object" );

				should.exist( cfg.expand["$ENV:TEST"] );
				cfg.expand["$ENV:TEST"].should.be.true;
			} );
		} );

		describe( "expand value", function()
		{
			it( "should read default.json and fetch an expanded value", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.expand );
				cfg.expand.should.be.a( "object" );

				should.exist( cfg.expand.test2 );
				cfg.expand.test2.should.be.equal( "test" );
			} );
		} );

		describe( "replace value", function()
		{
			before( function()
			{
				cfg = new Config();
			} );

			it( "should read default.json and fetch an replaced value", function()
			{
				should.exist( cfg );
				cfg.should.be.a( "Config" );
				( __dirname + "/cfg/default.json" ).should.be.a.file;

				should.exist( cfg.expand );
				cfg.expand.should.be.a( "object" );

				should.exist( cfg.expand.test3 );
				cfg.expand.test3.should.be.equal( process.platform );
			} );
		} );
*/
	} );
} );
