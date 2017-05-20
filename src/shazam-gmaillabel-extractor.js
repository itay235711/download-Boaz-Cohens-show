/**
 * Created by itay on 4/10/2017.
 */

const projectUtils = require('./utils.js');
const gmail = require('googleapis').gmail('v1');
const aoth_authenticator = require('./google_api/aoth_authenticator.js');
const moment = require('moment');
const _ = require('underscore-node');
const Promise = require("bluebird");
const deferred = require('deferred');
const denodeify = require('promise-denodeify');

initCallbacksBehavior();

module.exports = function (_googleUser) {

    const module = {
        extractShazamLabelNewSongTitles: extractShazamLabelNewSongTitles,
        markMessageAsReadBySongTitle : markMessageAsReadBySongTitle,
        markMessageAsProblematicBySongTitle : markMessageAsProblematicBySongTitle
    };

    // public
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
        return markSongByTitle(songTitle, markMessageAsRead);
    }

    function markMessageAsProblematicBySongTitle(songTitle) {
        return markSongByTitle(songTitle, markMessageAsProblematic);
    }

    // private
    function getAuthInstance() {
        if (_authInstance) {
            return Promise.resolve(_authInstance);
        }
        else {
            return aoth_authenticator.authenticate(_googleUser).then(auth => {
                _authInstance = auth;
                return Promise.resolve(auth);
            });
        }
    }

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
                titleExtractions.map(extrc => extrc.val).map(projectUtils.adjustSongTitle);
            return Promise.resolve(songTitles);
        }
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

    function markSongByTitle(songTitle, markingFunction) {

        const adjustedSongTitle = projectUtils.adjustSongTitle(songTitle);
        const messagesIds = _songTitleToMessageIdsMap[adjustedSongTitle];

        if (!messagesIds) {
            throw new Error("The song '" + songTitle + "' is known to this extractor");
        }

        const markingPromises = [];

        _.each(messagesIds, id => {
            const promise = markingFunction(id);
            markingPromises.push(promise);
        });

        return Promise.all(markingPromises);
    }

    function markMessageAsRead(messageId) {
        return getAuthInstance().then(auth =>
            gmail.users.messages.modify({
                userId: 'me',
                auth: auth,
                id: messageId,
                resource: {removeLabelIds: ["UNREAD", "IMPORTANT"]}
            })
        );
    }

    function markMessageAsProblematic(messageId) {
        return getAuthInstance().then(auth =>
            gmail.users.messages.modify({
                userId: 'me',
                auth: auth,
                id: messageId,
                resource: {
                    addLabelIds: ["IMPORTANT"],
                    removeLabelIds: ["UNREAD"]
                }
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
        const adjustedSongTitle = projectUtils.adjustSongTitle(songTitle);
        if (_songTitleToMessageIdsMap[adjustedSongTitle]) {
            _songTitleToMessageIdsMap[adjustedSongTitle].push(messageData.id);
        }
        else {
            _songTitleToMessageIdsMap[adjustedSongTitle] = [messageData.id]
        }
    }

    // members
    let _authInstance;
    const _songTitleToMessageIdsMap = {};

    return module;
};

function initCallbacksBehavior() {
    gmail.users.messages.list = denodeify(gmail.users.messages.list, Promise, false);
    gmail.users.messages.get = denodeify(gmail.users.messages.get, Promise, false);
    gmail.users.messages.modify = denodeify(gmail.users.messages.modify, Promise, false);
}