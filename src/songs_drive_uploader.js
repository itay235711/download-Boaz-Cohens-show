/**
 * Created by itay on 5/6/2017.
 */

const aoth_authenticator = require('./google_api/aoth_authenticator.js');
const drive = require('googleapis').drive('v3');
const denodeify = require('promise-denodeify');

initCallbacksBehavior();

module.exports = function (_googleUser) {
    const module = {
        uploadSongsDirToDrive : uploadSongsDirToDrive
    };

    // public
    function uploadSongsDirToDrive(songsDir) {
        return createDirForToday().then(todaysDirId => {
            var y = 1;
        });
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

    function getTodayDirName() {

        const todaysDate = new Date();
        const mm = todaysDate.getMonth() + 1; // getMonth() is zero-based
        const dd = todaysDate.getDate();

        const retDateStr = [todaysDate.getFullYear(),
            (mm>9 ? '' : '0') + mm,
            (dd>9 ? '' : '0') + dd
        ].join('_');

        return retDateStr;
    }

    function createDirForToday() {
        return getAuthInstance().then(auth => {
            const todayDirName = getTodayDirName();

            return drive.files.create({
                auth: auth,
                userId: 'me',
                fields: 'id',
                resource: {
                    'name' : todayDirName,
                    'mimeType' : 'application/vnd.google-apps.folder'
                }
            })
        }).then(dirRef => {
            return dirRef.id;
        });
    }

    // members
    let _authInstance;

    return module;
};

function initCallbacksBehavior() {
    drive.files.create = denodeify(drive.files.create, Promise, false);
}