/**
 * Created by itay on 1/12/2017.
 */

const _mailGoogleUser = 'itay235711';
const _driveGoogleUser = 'SongsSharer2';

const newYsd = require('./youtube-songs-downloader.js');
const extractor = require('./shazam_gmaillabel_extractor.js')(_mailGoogleUser);
const driveUploader = require('./songs_drive_uploader.js')(_driveGoogleUser);
const aoth_authenticator = require('./google_api/aoth_authenticator.js');
const fs = require('fs');
const path = require('path');
const projectUtils = require('./utils.js');
const cp = require('child_process');
const Promise = require("bluebird");
const denodeify = require('promise-denodeify');
const optimist = require('optimist');
const lineReader =  require('line-reader');

initCallbacksBehavior();


const MAIN_OUTPUT_DIR = 'C:\\Users\\itay\\home\\7_temp\\boazTestsDir\\';
const runConfig = extractConfigFromAppArgs();

switch (runConfig.mode) {
    case 'input_file':
        downloadSongTitlesFromFile(runConfig.file_path, runConfig.drive_upload);
        break;
    case 'single_title':
        downloadSongTitles([runConfig.title], MAIN_OUTPUT_DIR, false);
        break;
    case 'yedidyas_shazam':
        downloadShazamNewSongs();
        break;
    default:
        throw new Exception("unknown run mode '" + runConfig + "'");
}

function extractConfigFromAppArgs() {
    const runConfig = {};

    runConfig.mode = optimist
        .usage('Usage: node $0 --mode=[input_file|single_title|yedidyas_shazam]')
        .demand(['mode'])
        .argv.mode;

    switch (runConfig.mode) {
        case 'input_file':
            const demandedArgv = optimist
                .usage('Usage: node $0 --mode=input_file --file_path=[path to input file] --drive_upload=[true|false]')
                .demand(['file_path', 'drive_upload'])
                .argv;
            runConfig.file_path = demandedArgv.file_path;
            runConfig.drive_upload = demandedArgv.drive_upload == 'true';
            break;
        case 'single_title':
            runConfig.title = optimist
                .usage('Usage: node $0 --mode=single_title --title=[song title]')
                .demand(['title'])
                .argv.title;
            break;
        case 'yedidyas_shazam':
            break;
        default:
            throw new Exception("unknown run mode '" + runConfig + "'");
    }

    return runConfig;
}

function downloadSongTitles(songTitles, outputDir, uploadToDrive) {

    const ysd = initNewYsdWithDefaults();
    ysd.setOutputDir(outputDir);

    projectUtils.createDirIfNotExists(outputDir)
        .then(() => ysd.downloadSongsList(songTitles))
        .then(() => {
            if (uploadToDrive) {
                return driveUploader.uploadSongsDirToDrive(outputDir);
            }
        })
        .then(() => openWinExplorer(outputDir))
        .then(() => {
            console.log('done.');
            process.exit(0);
        })
        .catch(err => {
            console.log(err);
            process.exit(1);
    });
}

function downloadSongTitlesFromFile(inputFilePath, uploadToDrive) {
    const songTitles = [];

    lineReader.eachLine(inputFilePath, line => {
        if (!!line) {
            songTitles.push(line);
        }
    }).then(err => {
        if (err)
            throw err;

        const fileName = path.parse(inputFilePath).name;
        const outputDirPath = path.join(MAIN_OUTPUT_DIR, '\\', fileName);
        downloadSongTitles(songTitles, outputDirPath, uploadToDrive);
    });
}

function downloadShazamNewSongs() {

    extractor.extractShazamLabelNewSongTitles().then(songTitles =>{

        const todaysOutputDir = createTodaysOutputDir(MAIN_OUTPUT_DIR);

        const ysd = initNewYsdWithDefaults();
        ysd.setOutputDir(todaysOutputDir);

        ysd.assignOnSongDownloaded(extractor.markMessageAsReadBySongTitle);
        ysd.assignOnSongDownloadError(extractor.markMessageAsProblematicBySongTitle);

        ysd.downloadSongsList(songTitles)
            .then(() => openWinExplorer(todaysOutputDir))
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

function initNewYsdWithDefaults() {
    const ysd = newYsd();
    ysd.setMaxYtSearchResultsNumber(3)
       .setMaxSongDurationMinutes(30)
       .setMaxSongFileSizeOptions({ prefferedSizeLimitMB: 50, maxSizeLimitMB: 80});

    return ysd;
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

function openWinExplorer(dirPath) {
    return cp.exec('start "" "' + dirPath + '"');
}

function initCallbacksBehavior() {
    cp.exec = denodeify(cp.exec, Promise, false);
    lineReader.eachLine = denodeify(lineReader.eachLine, Promise, false);
}