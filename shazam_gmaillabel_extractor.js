/**
 * Created by itay on 4/10/2017.
 */

const google = require('googleapis');
const aoth_authenticator = require('./google_api/aoth_authenticator.js');
const moment = require('moment');

aoth_authenticator.authenticate().then(messagesInShazamLabel);

function messagesInShazamLabel(auth) {



    const gmail = google.gmail('v1');
    const initialRequest = gmail.users.messages.list({
        auth: auth,
        userId: 'me',
        q: getTodaysNewShazamMailsQuery(),
        maxResults: 200
    }, function (err, response) {
        if (err)
            console.log(err);
        else
            console.log(response.messages.length);
    });
    // listMessages('label:Shazam', function (messagesList) {
    //     console.log(messagesList);
    // });

    function listMessages(query, callback) {
        var getPageOfMessages = function(request, result) {
            request.execute(function(resp) {
                result = result.concat(resp.messages);
                var nextPageToken = resp.nextPageToken;
                if (!nextPageToken) {
                    callback(result);
                } else {
                    request = gapi.client.gmail.users.messages.list({
                        'userId': userId,
                        'pageToken': nextPageToken,
                        'q': query
                    });
                    getPageOfMessages(request, result);
                }
            });
        };
        const gmail = google.gmail('v1');
        const initialRequest = gmail.users.messages.list({
            auth: auth,
            userId: 'me',
            'q': query
        });
        getPageOfMessages(initialRequest, []);
    }
}

function getTodaysNewShazamMailsQuery() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 3);
    const after = moment(yesterday).format("YYYY/MM/DD");
    const query = 'label:Shazam after:' + after;
    return query;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
    var gmail = google.gmail('v1');

    gmail.users.labels.list({
        auth: auth,
        userId: 'me',
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var labels = response.labels;
        if (labels.length == 0) {
            console.log('No labels found.');
        } else {
            console.log('Labels:');
            for (var i = 0; i < labels.length; i++) {
                var label = labels[i];
                console.log('- %s', label.name);
            }
        }
    });
}
