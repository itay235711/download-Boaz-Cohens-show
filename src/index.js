/**
 * Created by itay on 1/12/2017.
 */

const _mailGoogleUser = 'itay235711';
const _driveGoogleUser = 'SongsSharer2';

const ysd = require('./youtube-songs-downloader.js')();
const extractor = require('./shazam_gmaillabel_extractor.js')(_mailGoogleUser);
const driveUploader = require('./songs_drive_uploader.js')(_driveGoogleUser);
const aoth_authenticator = require('./google_api/aoth_authenticator.js');
const fs = require('fs');
const path = require('path');
const projectUtils = require('./utils.js');
const cp = require('child_process');
const Promise = require("bluebird");
const denodeify = require('promise-denodeify');

initCallbacksBehavior();


downloadShazamNewSongs();

function downloadShazamNewSongs() {


    extractor.extractShazamLabelNewSongTitles().then(songTitles =>{
        const mainOutputDir = 'C:\\Users\\itay\\home\\7_temp\\boazTestsDir\\';

        const todaysOutputDir = createTodaysOutputDir(mainOutputDir);

        ysd.setOutputDir(todaysOutputDir)
            .setMaxYtSearchResultsNumber(3)
            .setMaxSongDurationMinutes(30)
            .setMaxSongFileSizeOptions({ prefferedSizeLimitMB: 50, maxSizeLimitMB: 80});

        ysd.assignOnSongDownloaded(extractor.markMessageAsReadBySongTitle);
        ysd.assignOnSongDownloadError(extractor.markMessageAsProblematicBySongTitle);

        ysd.downloadSongsList(songTitles)
            .then(() => cp.exec('start "" "' + todaysOutputDir + '"'))
            .then(() => driveUploader.uploadSongsDirToDrive(todaysOutputDir))
            .then(() => {
            console.log('done.');
            process.exit(0);
        }).catch(err => {

            reportErrorViaMail(err)
                .then(() => {
                console.error(err);
                process.exit(1);
            });
        });
    });
}

function reportErrorViaMail(err) {
    return aoth_authenticator.authenticate(_mailGoogleUser).then(auth => {
        console.log('Not implemented yet..');
    });
}

function testSongsDownloader() {
    ysd.setOutputDir('C:\\Users\\itay\\home\\7_temp\\boazTestsDir\\')
        .setMaxYtSearchResultsNumber(3);

    ysd.downloadSongsList(["Let Your Love Flow - The Bellamy Brothers"]).then(() => {
        process.exit(0);
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
}

function createTodaysOutputDir(outputDirPath) {
    const outputTodaysDir = path.join(outputDirPath, projectUtils.getTodayFsFriendlyName());
    projectUtils.createDirIfNotExists(outputTodaysDir);

    return outputTodaysDir;
}

function initCallbacksBehavior() {
    cp.exec = denodeify(cp.exec, Promise, false);
}