/**
 * Created by itay on 5/6/2017.
 */

const fs = require('fs');
const aoth_authenticator = require('./google_api/aoth_authenticator.js');
const drive = require('googleapis').drive('v3');
const denodeify = require('promise-denodeify');
const path = require('path');
const _ = require('underscore-node');

initCallbacksBehavior();

module.exports = function (_googleUser) {
    const module = {
        uploadSongsDirToDrive : uploadSongsDirToDrive
    };

    // public
    function uploadSongsDirToDrive(songsDir) {

        return fs.readdir(songsDir).then(songFiles => {
            let uploadsChainPromise = Promise.resolve();

            _.forEach(songFiles, (songFileName, i) => {
                const fileFullPath = path.join(songsDir, songFileName);

                uploadsChainPromise = uploadsChainPromise
                    .then(() => logSongUploadIter(i, songFiles, songFileName))
                    .then(getOrCreateDirForToday)
                    .then(todaysDirId => uploadSong(todaysDirId, fileFullPath));
            });

            return uploadsChainPromise;
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

    function getOrCreateDirForToday() {
        return getAuthInstance().then(auth => {
            const todaysDirName = getTodayDirName();

            return drive.files.list({
                auth: auth,
                userId: 'me',
                q: getTodaysDirQuery(todaysDirName),
                spaces: 'drive'
            }).then(res => {

                if (res.files.length > 0) {
                    return res.files[0];
                }
                else {
                    return drive.files.create({
                        auth: auth,
                        userId: 'me',
                        fields: 'id',
                        resource: {
                            'name': todaysDirName,
                            'mimeType': 'application/vnd.google-apps.folder'
                        }
                    });
                }
            });
        }).then(dirRef => {
            return dirRef.id;
        });
    }

    function uploadSong(todaysDirId, filePath) {
        return getAuthInstance().then(auth => {

            const fileName = path.basename(filePath);
            const fileStream = fs.createReadStream(filePath);

            return drive.files.create({
                auth: auth,
                userId: 'me',
                uploadType: 'multipart',
                resource: {
                    name: fileName,
                    parents: [todaysDirId]
                },
                media : {
                    body: fileStream
                }
            });
        });
    }

    function getTodayDirName() {

        const todaysDate = new Date();
        const mm = todaysDate.getMonth() + 1; // getMonth() is zero-based
        const dd = todaysDate.getDate();

        const retDateStr = [
            (mm>9 ? '' : '0') + mm,
            (dd>9 ? '' : '0') + dd,
            todaysDate.getFullYear()
        ].join('_');

        return retDateStr;
    }

    function getTodaysDirQuery(todaysDirName) {
        return "mimeType = 'application/vnd.google-apps.folder' and " +
            "name='" + todaysDirName + "' and " +
            "'root' in parents and " +
            "trashed = false";
    }

    function logSongUploadIter(i, songFiles, songFileName) {
        return console.log("Uploading song file " + (i + 1) +
            " out of " + songFiles.length + ": '" + songFileName + "'");
    }

    // members
    let _authInstance;

    return module;
};

function initCallbacksBehavior() {
    drive.files.create = denodeify(drive.files.create, Promise, false);
    drive.files.list = denodeify(drive.files.list, Promise, false);
    fs.readdir = denodeify(fs.readdir, Promise, false);
}