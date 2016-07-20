"use strict";

/**
 * Config module
 */

const fs = require( "fs" );
const path = require( "path" );
const util = require( "util" );

const sConfigPath = path.resolve( "./cfg" );

// ToDo: "default" config with settings, "local" config for user overrides; copy "default" -> "local" if "local" doesn't exist

// Godamnit, who thought that making it throw a exception would be good idea...
if( !( "_accessSync" in fs ) )
{
	fs._accessSync = fs.accessSync;
	fs.accessSync = ( sPath, eMode ) =>
	{
		try
		{
			fs._accessSync( sPath, eMode );
			return true;
		}
		catch( hException )
		{
			//console.warn( "fs.accessSync: " + hException );
			return false;
		}
	}
}

function StripComments( sString )
{
	if( typeof sString !== "string" ) sString = sString.toString();

	return sString.replace( /(\/\*(?:[\s\S]*?)\*\/)|([\s]*\/\/.*$)/gm, "" );
}

function UpdateConfig( pCallback )
{
	if( this.m_fNextUpdate > Date.now() ) return;

	// ToDo: make change event
	// ToDo: make per property change event
	if( typeof pCallback === "undefined" || pCallback === null )
	{
		if( fs.accessSync( this.m_sFilePath, fs.constants.F_OK | fs.constants.R_OK ) )
		{
			if( this.m_sFileExtension === ".json" || this.m_sFileExtension === ".js" || this.m_sFileExtension === ".cfg" )
			{
				let sData = fs.readFileSync( this.m_sFilePath ).toString();
				if( sData.length > 0 )
				{
					try
					{
						this.m_hConfig = JSON.parse( StripComments( sData ) );
					}
					catch( hException )
					{
						console.warn( hException );
					}
				}
				this.m_fNextUpdate = Date.now() + 5;
			}
		}
	}
	else
	{
		fs.access( this.m_sFilePath, fs.constants.F_OK | fs.constants.R_OK, ( hError ) =>
		{
			if( hError ) throw hError;

			if( this.m_sFileExtension === ".json" || this.m_sFileExtension === ".js" || this.m_sFileExtension === ".cfg" )
			{
				fs.readFile( this.m_sFilePath, ( hError, hData ) =>
				{
					if( hError ) throw hError;

					let sData = hData.toString();
					if( sData.length > 0 )
					{
						try
						{
							this.m_hConfig = JSON.parse( StripComments( sData ) );
						}
						catch( hException )
						{
							console.warn( hException );
						}
					}

					this.m_fNextUpdate = Date.now() + 5;

					pCallback();
				} );
			}
		} );
	}
}

function AttachWatcher( pCallback )
{
	let pAttach = () =>
	{
		// I'm really considering to drop this shitty function and use fs.watchFile instead, more efficient my ass...
		// In all those versions NodeJS had, this function not even once worked as it should...
		this.m_hWatcher = fs.watch( path.dirname( this.m_sFilePath ), { persistent: false }, ( sEvent, sFile ) =>
		{
			switch( sEvent )
			{
				case "change":
					if( sFile == this.m_sFile ) UpdateConfig.call( this );
				break;

				case "rename":
					if( sFile == this.m_sFile )
					{
						// ToDo: this event is fired for file renames AND file deletes, handle the latter...
						this.m_hWatcher = null;
					}
				break;

				default:
					console.log( "ConfigWatcher: sEvent( " + sEvent.toString() + " ) sFile( " + sFile.toString() + " )" );
				break;
			}
		} );

		this.m_hWatcher.on( "error", function( hException )
		{
			// I totally don't care, AT ALL...
			//console.log( hException );
		} );
	};

	if( typeof pCallback === "undefined" || pCallback === null )
	{
		UpdateConfig.call( this );
		pAttach();
	}
	else
	{
		UpdateConfig.call( this, () =>
		{
			pCallback();
			pAttach();
		} );
	}
}

function ExpandString( Element )
{
	if( typeof Element === "string" && Element.charAt( 0 ) === "$" )
	{
		let aElementParts = Element.substr( 1 ).split( ":", 2 );
		let sScope = aElementParts[0].toLowerCase();
		let sString = aElementParts[1].toLowerCase();

		console.log( "Config-ExpandString: " + aElementParts );
		// ToDo: add more
		if( sScope === "env" )
		{
			if( sString in process.env ) Element = process.env[sString];
			else Element = "";
		}
//		if( sScope === "platform" ) Element = process.platform;
	}

	return Element;
}

function CreateConfigObject()
{
	return new Proxy( this,
	{
		get: ( hObject, Key, hProxy ) =>
		{
			let hPrototype = Object.getPrototypeOf( hObject );

			//console.log( "Config::get(): " + Key.toString() );

			//if( Key === "prototype" ) return Object.getPrototypeOf( hObject );

			if( hObject.m_hConfig.hasOwnProperty( ExpandString( Key ) ) )
			{
				// hacky I know, but since the config should only contain primitives we should be fine...
				let Element = JSON.parse( JSON.stringify( hObject.m_hConfig[Key] ) );

				return ExpandString( Element );
			}

			if( hPrototype.hasOwnProperty( ExpandString( Key ) ) && typeof hPrototype[Key] === "function" ) return hPrototype[Key].bind( hObject );

			return hPrototype[Key];
		},
		set: ( hObject, sKey, Value, hProxy ) =>
		{
			// Don't allow writing to the config files, might extend that later to have read-only and read-write config's
			// Which is why I won't set the prevent extension flag for now...
			throw Error( "write access to object denied" );
		},
/*
		getPrototypeOf: ( hObject ) =>
		{
			console.log( "Config::GetPrototypeOf( hObject )" );

			return Object.getPrototypeOf( hObject );
		},
*/		setPrototypeOf: ( hObject, hPrototype ) =>
		{
			throw TypeError( "write access to prototype denied" );
		},

		has: ( hObject, Key ) =>
		{
			if( hObject.m_hConfig.hasOwnProperty( ExpandString( Key ) ) ) return true;

			return false;
		},
		ownKeys: ( hObject ) =>
		{
			let aKeys = [];

			aKeys = aKeys.concat( Object.getOwnPropertyNames( hObject.m_hConfig ) );

			return aKeys;
		}
	} );
}

/**
 * Class that contains a config file and keeps the object in sync with the file
 */
class Config
{
	static [Symbol.hasInstance]( hInstance )
	{
		return ( ( Symbol.toStringTag in hInstance ) && hInstance[Symbol.toStringTag] === "Config" );
	}

	/**
	 * Config settings can be accessed as array cfg["setting"] or as property cfg.setting
	 * @param {string} [sFile=default.json] - specify a file name, optionally with extension and / or subfolder relative to the cfg folder
	 * @param {(string|object)} [DefaultContent] - specify the default content of a new config file, a json compatible string expected, if it's a object it's converted into a json string
	 * @return {Proxy} - returns a proxy object that abstracts away the internal file <-> object handling
	 */
	constructor( sFile, DefaultContent )
	{
		try
		{
			fs.mkdirSync( sConfigPath );
		}
		catch( hException )
		{
		}

		this.m_fNextUpdate = -1;
		this.m_hConfig = {};

		this.m_sFileExtension = ".json";
		try
		{
			let sExtension = path.extname( sFile );
			if( sExtension.length > 0 ) this.m_sFileExtension = sExtension;
		}
		catch( hException )
		{
		}

		this.m_sFileName = path.basename( sFile || "default", this.m_sFileExtension );
		this.m_sFile = this.m_sFileName + this.m_sFileExtension;
		try
		{
			this.m_sFilePath = path.join( sConfigPath, path.dirname( sFile ), this.m_sFile );
		}
		catch( hException )
		{
			this.m_sFilePath = path.join( sConfigPath, this.m_sFile );
		}

		if( typeof DefaultContent !== "undefined" && DefaultContent !== null ) this.CreateDefaultConfig( DefaultContent );
		else AttachWatcher.call( this );

		// Some mechanics aren't able to use ProxyInstance[Symbol.toStringTag], so pass it directly into our prototype,
		// which has the side effect of not needing to re-define it trough the proxy
		Object.getPrototypeOf( this )[Symbol.toStringTag] = "Config";

		return CreateConfigObject.call( this );
	}

	/**
	 * Creates a new config file with the provided contents if it doesn't exist already
	 * @param {(string|object)} DefaultContent - specify the default content of a new config file, a json compatible string expected, if it's a object it's converted into a json string
	 * @param {boolean} [bSync=false] - should the code inside be called synchronous or asynchronous
	 */
	CreateDefaultConfig( DefaultContent, pCallback )
	{
		if( typeof pCallback === "undefined" || pCallback === null )
		{
			if( !fs.accessSync( this.m_sFilePath, fs.constants.F_OK ) )
			{
				if( ( this.m_sFileExtension === ".json" || this.m_sFileExtension === ".js" || this.m_sFileExtension === ".cfg" ) )
				{
					if( typeof DefaultContent === "object" ) DefaultContent = JSON.stringify( DefaultContent );

					fs.writeFileSync( this.m_sFilePath, DefaultContent );
				}
			}

			AttachWatcher.call( this );
		}
		else
		{
			fs.access( this.m_sFilePath, fs.constants.F_OK, ( hError ) =>
			{
				if( hError )
				{
					if( ( this.m_sFileExtension === ".json" || this.m_sFileExtension === ".js" || this.m_sFileExtension === ".cfg" ) )
					{
						if( typeof DefaultContent === "object" ) DefaultContent = JSON.stringify( DefaultContent );

						fs.writeFile( this.m_sFilePath, DefaultContent, ( hError ) =>
						{
							if( hError ) throw hError;

							AttachWatcher.call( this, pCallback );
						} );
					}
				}
				else AttachWatcher.call( this, pCallback );
			} );
		}
	}
}

module.exports = Config;
