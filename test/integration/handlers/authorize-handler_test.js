'use strict';

/**
 * Module dependencies.
 */

const AccessDeniedError = require('../../../lib/errors/access-denied-error');
const AuthenticateHandler = require('../../../lib/handlers/authenticate-handler');
const AuthorizeHandler = require('../../../lib/handlers/authorize-handler');
const CodeResponseType = require('../../../lib/response-types/code-response-type');
const InvalidArgumentError = require('../../../lib/errors/invalid-argument-error');
const InvalidClientError = require('../../../lib/errors/invalid-client-error');
const InvalidRequestError = require('../../../lib/errors/invalid-request-error');
const InvalidScopeError = require('../../../lib/errors/invalid-scope-error');
const UnsupportedResponseTypeError = require('../../../lib/errors/unsupported-response-type-error');
const Promise = require('bluebird');
const Request = require('../../../lib/request');
const Response = require('../../../lib/response');
const ServerError = require('../../../lib/errors/server-error');
const UnauthorizedClientError = require('../../../lib/errors/unauthorized-client-error');
const should = require('chai').should();
const url = require('url');

/**
 * Test `AuthorizeHandler` integration.
 */

describe('AuthorizeHandler integration', function() {
  describe('constructor()', function() {
    it('should throw an error if `options.authorizationCodeLifetime` is missing', function() {
      try {
        new AuthorizeHandler();

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `authorizationCodeLifetime`');
      }
    });

    it('should throw an error if `options.model` is missing', function() {
      try {
        new AuthorizeHandler({ authorizationCodeLifetime: 120 });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `model`');
      }
    });

    it('should throw an error if the model does not implement `getClient()`', function() {
      try {
        new AuthorizeHandler({ authorizationCodeLifetime: 120, model: {} });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: model does not implement `getClient()`');
      }
    });

    it('should throw an error if the model does not implement `saveAuthorizationCode()`', function() {
      try {
        new AuthorizeHandler({ authorizationCodeLifetime: 120, model: { getClient: function() {} } });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: model does not implement `saveAuthorizationCode()`');
      }
    });

    it('should throw an error if the model does not implement `getAccessToken()`', function() {
      const model = {
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };

      try {
        new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: model does not implement `getAccessToken()`');
      }
    });

    it('should set the `authorizationCodeLifetime`', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.authorizationCodeLifetime.should.equal(120);
    });

    it('should set the `authenticateHandler`', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.authenticateHandler.should.be.an.instanceOf(AuthenticateHandler);
    });

    it('should set the `model`', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.model.should.equal(model);
    });
  });

  describe('handle()', function() {
    it('should throw an error if `request` is missing', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      try {
        handler.handle();

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: `request` must be an instance of Request');
      }
    });

    it('should throw an error if `response` is missing', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: {}, headers: {}, method: {}, query: {} });

      try {
        handler.handle(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: `response` must be an instance of Response');
      }
    });

    it('should throw an error if `allowed` is `false`', function() {
      const model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          throw new Error('Unhandled exception');
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 'test'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          allowed: 'false',
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function(e) {
          e.should.be.an.instanceOf(AccessDeniedError);
          e.message.should.equal('Access denied: user denied access to application');
        });
    });

    it('should throw an error if `allowed` is `false` body', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { allowed: 'false' }, headers: {}, method: {}, query: {} });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function(e) {
          e.should.be.an.instanceOf(AccessDeniedError);
          e.message.should.equal('Access denied: user denied access to application');
        });
    });

    it('should redirect to an error response if a non-oauth error is thrown', function() {
      const model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          throw new Error('Unhandled exception');
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=server_error&error_description=Unhandled%20exception&state=foobar');
        });
    });

    it('should redirect to an error response if an oauth error is thrown', function() {
      const model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          throw new AccessDeniedError('Cannot request this auth code');
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=access_denied&error_description=Cannot%20request%20this%20auth%20code&state=foobar');
        });
    });

    it('should redirect to a successful response with `code` and `state` if successful', function() {
      const client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      const model = {
        getAccessToken: function() {
          return {
            client: client,
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return client;
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: client };
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(function() {
          response.get('location').should.equal('http://example.com/cb?code=12345&state=foobar');
        })
        .catch(should.fail);
    });

    it('should redirect to an error response if `scope` is invalid', function() {
      const model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          return {};
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          scope: [],
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=invalid_scope&error_description=Invalid%20parameter%3A%20%60scope%60&state=foobar');
        });
    });

    it('should redirect to a successful response if `model.validateScope` is not defined', function() {
      const client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      const model = {
        getAccessToken: function() {
          return {
            client: client,
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return client;
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: client };
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          scope: 'read',
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(function(data) {
          data.should.eql({
            authorizationCode: 12345,
            client: client
          });
        })
        .catch(should.fail);
    });

    it('should redirect to an error response if `scope` is insufficient', function() {
      const client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      const model = {
        getAccessToken: function() {
          return {
            client: client,
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return client;
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: client };
        },
        validateScope: function() {
          return false;
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          scope: 'read',
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=invalid_scope&error_description=Invalid%20scope%3A%20Requested%20scope%20is%20invalid&state=foobar');
        });
    });

    it('should redirect to an error response if `state` is missing', function() {
      const model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          throw new AccessDeniedError('Cannot request this auth code');
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {}
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=invalid_request&error_description=Missing%20parameter%3A%20%60state%60');
        });
    });

    it('should redirect to an error response if `response_type` is invalid', function() {
      const model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: {} };
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'test'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=unsupported_response_type&error_description=Unsupported%20response%20type%3A%20%60response_type%60%20is%20not%20supported&state=foobar');
        });
    });

    it('should fail on invalid `response_type` before calling model.saveAuthorizationCode()', function() {
      const model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          throw new Error('must not be reached');
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'test'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=unsupported_response_type&error_description=Unsupported%20response%20type%3A%20%60response_type%60%20is%20not%20supported&state=foobar');
        });
    });

    it('should return the `code` if successful', function() {
      const client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      const model = {
        getAccessToken: function() {
          return {
            client: client,
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return client;
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: client };
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: {
          client_id: 12345,
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      const response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(function(data) {
          data.should.eql({
            authorizationCode: 12345,
            client: client
          });
        })
        .catch(should.fail);
    });
  });

  describe('generateAuthorizationCode()', function() {
    it('should return an auth code', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      return handler.generateAuthorizationCode()
        .then(function(data) {
          data.should.be.a.sha256();
        })
        .catch(should.fail);
    });

    it('should support promises', function() {
      const model = {
        generateAuthorizationCode: function() {
          return Promise.resolve({});
        },
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.generateAuthorizationCode().should.be.an.instanceOf(Promise);
    });

    it('should support non-promises', function() {
      const model = {
        generateAuthorizationCode: function() {
          return {};
        },
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.generateAuthorizationCode().should.be.an.instanceOf(Promise);
    });
  });

  describe('getAuthorizationCodeLifetime()', function() {
    it('should return a date', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.getAuthorizationCodeLifetime().should.be.an.instanceOf(Date);
    });
  });

  describe('validateRedirectUri()', function() {
    it('should support empty method', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };

      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.validateRedirectUri('http://example.com/a', { redirectUris: ['http://example.com/a'] }).should.be.an.instanceOf(Promise);
    });

    it('should support promises', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {},
        validateRedirectUri: function() {
          return Promise.resolve(true);
        }
      };

      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.validateRedirectUri('http://example.com/a', { }).should.be.an.instanceOf(Promise);
    });

    it('should support non-promises', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {},
        validateRedirectUri: function() {
          return true;
        }
      };

      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.validateRedirectUri('http://example.com/a', { }).should.be.an.instanceOf(Promise);
    });

    it('should support callbacks', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {},
        validateRedirectUri: function(redirectUri, client, callback) {
          callback(null, false);
        }
      };

      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.validateRedirectUri('http://example.com/a', { }).should.be.an.instanceOf(Promise);
    });
  });

  describe('getClient()', function() {
    it('should throw an error if `client_id` is missing', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { response_type: 'code' }, headers: {}, method: {}, query: {} });

      try {
        handler.getClient(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Missing parameter: `client_id`');
      }
    });

    it('should throw an error if `client_id` is invalid', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { client_id: 'øå€£‰', response_type: 'code' }, headers: {}, method: {}, query: {} });

      try {
        handler.getClient(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Invalid parameter: `client_id`');
      }
    });

    it('should throw an error if `client.redirectUri` is invalid', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { client_id: 12345, response_type: 'code', redirect_uri: 'foobar' }, headers: {}, method: {}, query: {} });

      try {
        handler.getClient(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Invalid request: `redirect_uri` is not a valid URI');
      }
    });

    it('should throw an error if `client` is missing', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail)
        .catch(function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: client credentials are invalid');
        });
    });

    it('should throw an error if `client.grants` is missing', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {
          return {};
        },
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail)
        .catch(function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: missing client `grants`');
        });
    });

    it('should throw an error if `client` is unauthorized', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {
          return { grants: [] };
        },
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail)
        .catch(function(e) {
          e.should.be.an.instanceOf(UnauthorizedClientError);
          e.message.should.equal('Unauthorized client: `grant_type` is invalid');
        });
    });

    it('should throw an error if `client.redirectUri` is missing', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() { return { grants: ['authorization_code'] }; },
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail)
        .catch(function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: missing client `redirectUri`');
        });
    });

    it('should throw an error if `client.redirectUri` is not equal to `redirectUri`', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['https://example.com'] };
        },
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { client_id: 12345, response_type: 'code', redirect_uri: 'https://foobar.com' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail)
        .catch(function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: `redirect_uri` does not match client value');
        });
    });

    it('should support promises', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {
          return Promise.resolve({ grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] });
        },
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: { client_id: 12345 },
        headers: {},
        method: {},
        query: {}
      });

      handler.getClient(request).should.be.an.instanceOf(Promise);
    });

    it('should support non-promises', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: { client_id: 12345 },
        headers: {},
        method: {},
        query: {}
      });

      handler.getClient(request).should.be.an.instanceOf(Promise);
    });

    it('should support callbacks', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function(clientId, clientSecret, callback) {
          should.equal(clientSecret, null);
          callback(null, { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] });
        },
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({
        body: { client_id: 12345 },
        headers: {},
        method: {},
        query: {}
      });

      handler.getClient(request).should.be.an.instanceOf(Promise);
    });

    describe('with `client_id` in the request query', function() {
      it('should return a client', function() {
        const client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        const model = {
          getAccessToken: function() {},
          getClient: function() {
            return client;
          },
          saveAuthorizationCode: function() {}
        };
        const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        const request = new Request({ body: { response_type: 'code' }, headers: {}, method: {}, query: { client_id: 12345 } });

        return handler.getClient(request)
          .then(function(data) {
            data.should.equal(client);
          })
          .catch(should.fail);
      });
    });
  });

  describe('getScope()', function() {
    it('should throw an error if `scope` is invalid', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { scope: 'øå€£‰' }, headers: {}, method: {}, query: {} });

      try {
        handler.getScope(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidScopeError);
        e.message.should.equal('Invalid parameter: `scope`');
      }
    });

    describe('with `scope` in the request body', function() {
      it('should return the scope', function() {
        const model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        const request = new Request({ body: { scope: 'foo' }, headers: {}, method: {}, query: {} });

        handler.getScope(request).should.equal('foo');
      });
    });

    describe('with `scope` in the request query', function() {
      it('should return the scope', function() {
        const model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        const request = new Request({ body: {}, headers: {}, method: {}, query: { scope: 'foo' } });

        handler.getScope(request).should.equal('foo');
      });
    });
  });

  describe('getState()', function() {
    it('should throw an error if `allowEmptyState` is false and `state` is missing', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ allowEmptyState: false, authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: {}, headers: {}, method: {}, query: {} });

      try {
        handler.getState(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Missing parameter: `state`');
      }
    });

    it('should allow missing `state` if `allowEmptyState` is valid', function () {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ allowEmptyState: true, authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: {}, headers: {}, method: {}, query: {} });
      const state = handler.getState(request);
      should.equal(state, undefined);
    });

    it('should throw an error if `state` is invalid', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: {}, headers: {}, method: {}, query: { state: 'øå€£‰' } });

      try {
        handler.getState(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Invalid parameter: `state`');
      }
    });

    describe('with `state` in the request body', function() {
      it('should return the state', function() {
        const model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        const request = new Request({ body: { state: 'foobar' }, headers: {}, method: {}, query: {} });

        handler.getState(request).should.equal('foobar');
      });
    });

    describe('with `state` in the request query', function() {
      it('should return the state', function() {
        const model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        const request = new Request({ body: {}, headers: {}, method: {}, query: { state: 'foobar' } });

        handler.getState(request).should.equal('foobar');
      });
    });
  });

  describe('getUser()', function() {
    it('should throw an error if `user` is missing', function() {
      const authenticateHandler = { handle: function() {} };
      const model = {
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authenticateHandler: authenticateHandler, authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: {}, headers: {}, method: {}, query: {} });
      const response = new Response();

      return handler.getUser(request, response)
        .then(should.fail)
        .catch(function (e) {
          e.should.be.an.instanceOf(ServerError);
          e.message.should.equal('Server error: `handle()` did not return a `user` object');
        });
    });

    it('should return a user', function() {
      const user = {};
      const model = {
        getAccessToken: function() {
          return {
            user: user,
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: {}, headers: { 'Authorization': 'Bearer foo' }, method: {}, query: {} });
      const response = new Response({ body: {}, headers: {} });

      return handler.getUser(request, response)
        .then(function(data) {
          data.should.equal(user);
        })
        .catch(should.fail);
    });
  });

  describe('saveAuthorizationCode()', function() {
    it('should return an auth code', function() {
      const authorizationCode = {};
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {
          return authorizationCode;
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      return handler.saveAuthorizationCode('foo', 'bar', 'biz', 'baz')
        .then(function(data) {
          data.should.equal(authorizationCode);
        })
        .catch(should.fail);
    });

    it('should support promises when calling `model.saveAuthorizationCode()`', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {
          return Promise.resolve({});
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.saveAuthorizationCode('foo', 'bar', 'biz', 'baz').should.be.an.instanceOf(Promise);
    });

    it('should support non-promises when calling `model.saveAuthorizationCode()`', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {
          return {};
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.saveAuthorizationCode('foo', 'bar', 'biz', 'baz').should.be.an.instanceOf(Promise);
    });

    it('should support callbacks when calling `model.saveAuthorizationCode()`', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function(code, client, user, callback) {
          return callback(null, true);
        }
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.saveAuthorizationCode('foo', 'bar', 'biz', 'baz').should.be.an.instanceOf(Promise);
    });
  });

  describe('getResponseType()', function() {
    it('should throw an error if `response_type` is missing', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: {}, headers: {}, method: {}, query: {} });

      try {
        handler.getResponseType(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Missing parameter: `response_type`');
      }
    });

    it('should throw an error if `response_type` is not `code`', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const request = new Request({ body: { response_type: 'foobar' }, headers: {}, method: {}, query: {} });

      try {
        handler.getResponseType(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(UnsupportedResponseTypeError);
        e.message.should.equal('Unsupported response type: `response_type` is not supported');
      }
    });

    describe('with `response_type` in the request body', function() {
      it('should return a response type', function() {
        const model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        const request = new Request({ body: { response_type: 'code' }, headers: {}, method: {}, query: {} });
        const ResponseType = handler.getResponseType(request);

        ResponseType.should.equal(CodeResponseType);
      });
    });

    describe('with `response_type` in the request query', function() {
      it('should return a response type', function() {
        const model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        const request = new Request({ body: {}, headers: {}, method: {}, query: { response_type: 'code' } });
        const ResponseType = handler.getResponseType(request);

        ResponseType.should.equal(CodeResponseType);
      });
    });
  });

  describe('buildSuccessRedirectUri()', function() {
    it('should return a redirect uri', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const responseType = new CodeResponseType(12345);
      const redirectUri = handler.buildSuccessRedirectUri('http://example.com/cb', responseType);

      url.format(redirectUri).should.equal('http://example.com/cb?code=12345');
    });
  });

  describe('buildErrorRedirectUri()', function() {
    it('should set `error_description` if available', function() {
      const error = new InvalidClientError('foo bar');
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const redirectUri = handler.buildErrorRedirectUri('http://example.com/cb', error);

      url.format(redirectUri).should.equal('http://example.com/cb?error=invalid_client&error_description=foo%20bar');
    });

    it('should return a redirect uri', function() {
      const error = new InvalidClientError();
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const redirectUri = handler.buildErrorRedirectUri('http://example.com/cb', error);

      url.format(redirectUri).should.equal('http://example.com/cb?error=invalid_client&error_description=Bad%20Request');
    });
  });

  describe('updateResponse()', function() {
    it('should set the `location` header', function() {
      const model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      const handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      const response = new Response({ body: {}, headers: {} });
      const uri = url.parse('http://example.com/cb');

      handler.updateResponse(response, uri, 'foobar');

      response.get('location').should.equal('http://example.com/cb?state=foobar');
    });
  });
});
