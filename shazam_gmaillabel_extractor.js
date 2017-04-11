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

module.exports = function () {

    const module = {
        extractShazamLabelNewSongTitles: extractShazamLabelNewSongTitles,
        markMessageAsReadBySongTitle : markMessageAsReadBySongTitle
    };

    // public
    function getAuthInstance() {
        if (_authInstance) {
            return Promise.resolve(_authInstance);
        }
        else {
            return aoth_authenticator.authenticate().then(auth => {
                _authInstance = auth;
                return Promise.resolve(auth);
            });
        }
    }

    function extractShazamLabelNewSongTitles() {
        return queryNewShazamLabelMessages()
            .then(response => {
                if (response.resultSizeEstimate == 0) {
                    console.log('No new messages to process.');
                    return Promise.resolve([]);
                }
                else {
                    console.log(response.messages.length + ' new messages to process.');

                    const fetchAllMessagesContentPromise = Promise.all(response.messages.map(
                        messageDetails => fetchMessageContent(messageDetails))
                    );
                    return fetchAllMessagesContentPromise
                        .then(extractMessagesSongTitles);
                }
            });
    }

    function markMessageAsReadBySongTitle(songTitle) {
        const messagesIds = _songTitleToMessageIdsMap[songTitle];

        if (!messagesIds) {
            throw new Error("The song '" + songTitle + "' is known to this extractor");
        }

        const unmarkingPromises = [];

        _.each(messagesIds, id => {
            const promise = markMessageAsRead(id);
            unmarkingPromises.push(promise);
        });

        return Promise.all(unmarkingPromises);
    }

    // private
    function queryNewShazamLabelMessages() {
        return getAuthInstance().then(auth => {
            return gmail.users.messages.list({
                auth: auth,
                userId: 'me',
                q: buildNewShazamMailsQuery(),
                maxResults: 300
            });
        });
    }

    function buildNewShazamMailsQuery() {
        // const today = new Date();
        // const yesterday = new Date(today);
        // yesterday.setDate(today.getDate() - 4);
        // const after = moment(yesterday).format("YYYY/MM/DD");
        // const query = 'label:Shazam after:' + after;
        // return query;

        return 'label:shazam label:unread';
    }

    function extractMessagesSongTitles(messagesData) {
        const titleExtractions = messagesData.map(tryExtractMessageSongTitle);
        const someErrorsAccrued = _.some(titleExtractions, extrc => extrc.err);
        if (someErrorsAccrued) {
            const errors = _.filter(titleExtractions, extrc => extrc.err).map(extrc => extrc.err);
            return Promise.reject(new Error('The following errors accrued:\n' + errors.join('\n')));
        }
        else {
            const songTitles =
                titleExtractions.map(extrc => extrc.val).map(adjustSpecialChars);
            return Promise.resolve(songTitles);
        }
    }

    function adjustSpecialChars(songTile) {
        let adjustedSongTitle = songTile;
        for (let sc in MESSAGE_SPECIAL_CHARS_MAP) {
            adjustedSongTitle = adjustedSongTitle.replace(sc, MESSAGE_SPECIAL_CHARS_MAP[sc]);
        }

        return adjustedSongTitle;
    }

    function fetchMessageContent(messageDetails) {
        return getAuthInstance().then(auth => {
            return gmail.users.messages.get({
                auth: auth,
                userId: 'me',
                id: messageDetails.id,
                format: 'full'
            });
        });
    }

    function markMessageAsRead(messageId) {
        return getAuthInstance().then(auth =>
            gmail.users.messages.modify({
                userId: 'me',
                auth: auth,
                id: messageId,
                resource: {removeLabelIds: ["UNREAD"]}
            })
        );
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
                mapMessageToSongTitle(songTitle, messageData);
            }
        }

        return ret;
    }

    // On theory song title can appear on multiple mails, so map array of ids instead of
    // just one. Practicably this array will contain only one id 99% of the times.
    function mapMessageToSongTitle(songTitle, messageData) {
        if (_songTitleToMessageIdsMap[songTitle]) {
            _songTitleToMessageIdsMap[songTitle].push(messageData.id);
        }
        else {
            _songTitleToMessageIdsMap[songTitle] = [messageData.id]
        }
    }

    // members
    let _authInstance;
    const _songTitleToMessageIdsMap = {};
    const MESSAGE_SPECIAL_CHARS_MAP = {
        '&#39;':"",
        '&amp;':""
    };

    return module;
};

function initCallbacksBehavior() {
    gmail.users.messages.list = denodeify(gmail.users.messages.list, Promise, false);
    gmail.users.messages.get = denodeify(gmail.users.messages.get, Promise, false);
    gmail.users.messages.modify = denodeify(gmail.users.messages.modify, Promise, false);
}