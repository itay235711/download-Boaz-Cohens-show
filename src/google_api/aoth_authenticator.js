/**
 * Created by itay on 4/10/2017.
 */

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var path = require('path');


// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/gmail-nodejs-quickstart.json
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';



function authenticate(googleUser) {

    return new Promise(function(resolve, reject){
        // Load client secrets from a local file.
        fs.readFile(getClientSecretPath(googleUser), function processClientSecrets(err, content) {
            if (err) {
                console.log('Error loading client secret file: ' + err);
                reject(err);
            }
            // Authorize a client with the loaded credentials, then call the
            // Gmail API.
            authorize(googleUser, JSON.parse(content), resolve);
        });
    });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(googleUser, credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
    var tokenPath = getUserTokenFilePath(googleUser);

    // Check if we have previously stored a token.
    fs.readFile(tokenPath, function(err, token) {
        if (err) {
            getNewToken(googleUser, oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}


/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(googleUser, oauth2Client, callback) {
    var scopes = chooseScopesForUser(googleUser);
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(googleUser, token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(googleUser, token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }

    var tokenPath = getUserTokenFilePath(googleUser);
    fs.writeFile(tokenPath, JSON.stringify(token));
    console.log('Token stored to ' + tokenPath);
}

function getUserTokenFilePath(googleUser) {
    return path.join(TOKEN_DIR, googleUser) + '.json';
}

function getClientSecretPath(googleUser) {
    return 'src/google_api/' + googleUser + '_client_secret.json';
}

function chooseScopesForUser(googleUser) {
    switch (googleUser) {
        case 'itay235711':
            return  [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://mail.google.com/',
                'https://www.googleapis.com/auth/gmail.modify'
            ];
        case 'SongsSharer2':
            return [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.appdata',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata',
                'https://www.googleapis.com/auth/drive.metadata.readonly',
                'https://www.googleapis.com/auth/drive.photos.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ];
        default:
            throw "The user '" + googleUser + "' is unknown to this authenticator"
    }
}

module.exports.authenticate = authenticate;