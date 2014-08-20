/**
* Copyright (c) 2014​, salesforce.com, inc.
* All rights reserved.
*
* Redistribution and use in source and binary forms, with or without modification, are permitted provided
* that the following conditions are met:
*
*    Redistributions of source code must retain the above copyright notice, this list of conditions and the
*    following disclaimer.
*
*    Redistributions in binary form must reproduce the above copyright notice, this list of conditions and
*    the following disclaimer in the documentation and/or other materials provided with the distribution.
*
*    Neither the name of salesforce.com, inc. nor the names of its contributors may be used to endorse or
*    promote products derived from this software without specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
* WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
* PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
* ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
* TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
* HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
* NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
* POSSIBILITY OF SUCH DAMAGE.
*/

var version  = require( '../package.json').version;
var request  = require( 'request');
var _        = require( 'lodash' );
var url      = require( 'url' );
var FuelAuth = require( 'fuel-auth' );


var FuelRest = function( authOptions, restEndpoint ) {
	'use strict';

	try {
		this.AuthClient = new FuelAuth( authOptions );
	} catch( err ) {
		console.log( err );
		return;
	}

	// adding version to object
	this.version = version;

	// setting up default headers
	this.defaultHeaders = {
		'User-Agent': 'node-fuel/' + this.version
		, 'Content-Type': 'application/json'
	};

	// configuring rest options
	this.requestOptions     = {};
	this.requestOptions.uri = restEndpoint || 'https://www.exacttargetapis.com';
};

FuelRest.prototype.apiRequest = function( type, uri, options, callback ) {
	'use strict';

	var requestOptions = options && options.requestOptions || {};
	var authOptions    = options && options.authOptions || {};

	// setting up request options
	requestOptions         = _.merge( {}, this.requestOptions, requestOptions );
	requestOptions.uri     = url.resolve( requestOptions.uri, uri ); // resolving url to be used for request
	requestOptions.method  = type;
	requestOptions.headers = _.merge( {}, this.defaultHeaders, requestOptions.headers );


	this.AuthClient.getAccessToken( authOptions, function( err, body ) {
		var localError;

		if( !!err ) {
			this._deliverResponse( 'error', err, callback, 'FuelAuth' );
			return;
		}

		// if there's no access token we have a problem
		if( !body.accessToken ) {
			localError     = new Error( 'No access token' );
			localError.res = body;
			this._deliverResponse( 'error', localError, callback, 'FuelAuth' );
			return;
		}

		// adding the bearer token
		requestOptions.headers.Authorization = requestOptions.headers.Authorization || 'Bearer ' + body.accessToken;

		// send request to api
		request( requestOptions, function( err, res, body ) {
			var parsedBody;

			if( err ) {
				this._deliverResponse( 'error', err, callback, 'Request Module inside apiRequest' );
				return;
			}

			// checking to make sure it's json from api
			if( res.headers[ 'content-type' ].split( ';' )[ 0 ].toLowerCase() !== 'application/json' ) {
				this._deliverResponse( 'error', new Error('API did not return JSON'), callback, 'Fuel REST' );
				return;
			}

			// trying to parse body
			try {
				parsedBody = JSON.parse( body );
			} catch( err ) {
				parsedBody = body;
			}

			this._deliverResponse( 'response', { res: res, body: parsedBody }, callback );

		}.bind( this ) );

	}.bind( this ) );
};

FuelRest.prototype.get = function( uri, options, callback ) {
	'use strict';

	this.apiRequest( 'GET', uri, options, callback );
};

FuelRest.prototype.post = function( uri, data, options, callback ) {
	'use strict';

	options = this._mergePostData( data, options );

	this.apiRequest( 'POST', uri, options, callback );
};

FuelRest.prototype.put = function( uri, data, options, callback ) {
	'use strict';

	options = this._mergePostData( data, options );

	this.apiRequest( 'PUT', uri, options, callback );
};

FuelRest.prototype.delete = function( uri, data, options, callback ) {
	'use strict';

	options = this._mergePostData( data, options );

	this.apiRequest( 'DELETE', uri, options, callback );
};


FuelRest.prototype._deliverResponse = function( type, data, callback, errorFrom ) {
	'use strict';

	// if it's an error and we have where it occured, let's tack it on
	if( type === 'error' ) {

		if( !!errorFrom ) {
			data.errorPropagatedFrom = errorFrom;
		}

		callback( data, null );

	} else if( type === 'response' ) {

		callback( null, data );

	}
};

FuelRest.prototype._mergePostData = function( data, options ) {
	'use strict';

	if( !!data ) {
		options = options || {};
		options.requestOptions = options.requestOptions || {};
		options.requestOptions.json = _.merge( {}, options.requestOptions.json || {}, data );
	}

	return data;
};

module.exports = FuelRest;
