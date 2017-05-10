/**
 * Created by itay on 5/6/2017.
 */

const fs = require('fs');
const aoth_authenticator = require('./google_api/aoth_authenticator.js');
//noinspection JSUnresolvedFunction
const drive = require('googleapis').drive('v3');
const denodeify = require('promise-denodeify');
const path = require('path');
const _ = require('underscore-node');
const projectUtils = require('./utils.js');
const Promise = require("bluebird");


initCallbacksBehavior();

module.exports = function (_googleUser) {
    const module = {
        uploadSongsDirToDrive : uploadSongsDirToDrive
    };

    // public
    function uploadSongsDirToDrive(songsDir) {

        const uploadedSongsInnerDir = path.join(songsDir, '/uploaded');

        return fs.readdir(songsDir)
            .then(dirEntriesNames => {
                let uploadsChainPromise = Promise.resolve();

                const dirEntries = dirEntriesNames.map(name => { return {name:name, fullPath:path.join(songsDir, name)}; });
                const songFiles = dirEntries.filter(entry => fs.statSync(entry.fullPath).isFile());
                songFiles.forEach((songFile, i) => {

                    uploadsChainPromise = uploadsChainPromise
                        .then(() => projectUtils.createDirIfNotExists(uploadedSongsInnerDir))
                        .then(() => logSongUploadIter(i, songFiles, songFile.name))
                        .then(getOrCreateDirForToday)
                        .then(todaysDirId => uploadSong(todaysDirId, songFile.fullPath))
                        .then(() => projectUtils.moveFileToDir(songFile.fullPath, uploadedSongsInnerDir));
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
            const todaysDirName = projectUtils.getTodayFsFriendlyName();

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