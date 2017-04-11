/**
 * Created by itay on 4/10/2017.
 */

const gmail = require('googleapis').gmail('v1');
const aoth_authenticator = require('./google_api/aoth_authenticator.js');
const moment = require('moment');
const _ = require('underscore-node');
const Promise = require("bluebird");
const deferred = require('deferred');
const denodeify = require('promise-denodeify');

initCallbacksBehavior();

module.exports.extractShazamLabelNewSongTitles = extractShazamLabelNewSongTitles;

function extractShazamLabelNewSongTitles() {
    return aoth_authenticator.authenticate().then(auth => {
        return queryNewShazamLabelMessages(auth)
            .then(response => {
                if (response.resultSizeEstimate == 0) {
                    console.log('No new messages to process.');
                }
                else {
                    console.log(response.messages.length + ' new messages to process.');

                    const fetchAllMessagesContentPromise = Promise.all(response.messages.map(
                        messageDetails => fetchMessageContent(messageDetails, auth))
                    );
                    return fetchAllMessagesContentPromise
                        .then(extractMessagesSongTitles);
                }
            });
    });
}

function queryNewShazamLabelMessages(auth) {
    const reqPromise = gmail.users.messages.list({
        auth: auth,
        userId: 'me',
        q: getTodaysNewShazamMailsQuery(),
        maxResults: 200
    });
    return reqPromise;
}

function getTodaysNewShazamMailsQuery() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 4);
    const after = moment(yesterday).format("YYYY/MM/DD");
    const query = 'label:Shazam after:' + after;
    return query;
}

function extractMessagesSongTitles(messagesData) {
    const titleExtractions = messagesData.map(tryExtractMessageSongTitle);
    const someErrorsAccrued = _.some(titleExtractions, extrc => extrc.err);
    if (someErrorsAccrued) {
        const errors = _.filter(titleExtractions, extrc => extrc.err).map(extrc => extrc.err);
        throw new Error('The following errors accrued:\n' + errors.join('\n'));
    }
    else {
        const songTitles = titleExtractions.map(extrc => extrc.val);
        return songTitles;
    }
}

function fetchMessageContent(messageDetails, auth) {
    const reqPromise = gmail.users.messages.get({
        auth: auth,
        userId: 'me',
        id: messageDetails.id,
        format: 'full'
    });
    return reqPromise;
}

function tryExtractMessageSongTitle(messageData) {

    // // mock
    // messageData = {
    //     // snippet : 'I used Shazam to discover Let Your Love Flow by The Bellamy Brothers. https://shz.am/t424735'
    //     snippet : 'I just used Shazam to discover Love Me Do by Ringo Starr. https://shz.am/t55720892'
    // };

    const OPTIONAL_PREFIXES = [
        'I used Shazam to discover ',
        'I just used Shazam to discover '
    ];

    const ret = { err:undefined, val:undefined};

    const content = messageData.snippet;
    if (!content){
        ret.err = "No 'snippet' field in message";
    }
    else {
        const extractionRegex = '(' + OPTIONAL_PREFIXES.join('|') + ')' + '([^\.]*)';
        const matches = new RegExp(extractionRegex, 'g').exec(content);

        const matched =  matches && matches.length > 1;
        if (!matched) {
            ret.err = "Known prefixes regex did not match the following message: '" + content + "'";
        }
        else {
            const songTitle = _.last(matches);
            ret.val = songTitle;
        }
    }

    return ret;
}

function initCallbacksBehavior() {
    gmail.users.messages.list = denodeify(gmail.users.messages.list, Promise, false);
    gmail.users.messages.get = denodeify(gmail.users.messages.get, Promise, false);
}