/**
 * Created by itay on 1/12/2017.
 */
const _ = require('underscore-node');
const fs = require('fs');
const youtubeDl = require('youtube-dl');
let YoutubeApi;
const Promise = require("bluebird");
const denodeify = require('promise-denodeify');
const deferred = require('deferred');
const FfmpegCommand = require('fluent-ffmpeg');

initCallbacksBehavior();

module.exports = function () {
    // public
    const module = {
        setOutputDir: setOutputDir,
        setMaxYtSearchResultsNumber : setMaxYtSearchResultsNumber,
        downloadSongsList: downloadSongsList
    };

    // private
    let _outputDir;
    let _maxYtSearchResultsNumber = 3;
    const YOUTUBE_URL = 'https://www.youtube.com';
    const FFMPEG_PATH = '.\\ffmpeg\\ffmpeg-20170112-6596b34-win64-static\\bin\\ffmpeg.exe';

    function setOutputDir(outputDirPath) {
        if (!fs.existsSync(outputDirPath)){
            fs.mkdirSync(outputDirPath);
        }
        _outputDir = outputDirPath;

        return module;
    }

    function setMaxYtSearchResultsNumber(maxNumber) {
        _maxYtSearchResultsNumber = maxNumber;

        return module;
    }

    function downloadSongsList(songsList) {
        if (!songsList || !Array.isArray(songsList)) {
            return createRejectPromise(new Error("'songsList' must be an array"));
        }
        else {
            const downloadPromises = [];
            for (let i = 0; i < songsList.length; i++) {
                const songTitle = songsList[i];
                const songPromise = downloadSong(songTitle);
                downloadPromises.push(songPromise);
            }

            return Promise.all(downloadPromises);
        }
    }

    function downloadSong(songTitle) {
        const completeProcessDef = deferred();
        const youtubeApi = new YoutubeApi();
        youtubeApi.setKey('AIzaSyB1OOSpTREs85WUMvIgJvLTZKye4BVsoFU');

        youtubeApi.search(songTitle, _maxYtSearchResultsNumber).then(function(result) {
            const videoUrls = _.map(result.items, function (itm) {
                const url = formatVideoUrl(itm.id.videoId);
                return url;
            });

            const videoDownloadPromises = [];
            _.each(videoUrls, function (url) {
                const deff = deferred();
                videoDownloadPromises.push(deff.promise);

                const downloadEntry = youtubeDl(url,  ['--format=18']);

                downloadEntry.on('info', function (info) {
                    deff.resolve({info: info, downloadEntry: downloadEntry});
                });
            });

            return Promise.all(videoDownloadPromises);

        }).then(videosDownload => {

            let bestQualityVideo = undefined;
            let bestQualityVideoSize = -1;

            _.each(videosDownload, function (videosDownload) {
                if (videosDownload.info.size > bestQualityVideoSize) {
                    bestQualityVideo = videosDownload;
                    bestQualityVideoSize = videosDownload.info.size;
                }
            });

            const outputFilePath = _outputDir + '\\' + bestQualityVideo.info.title + '.mp3';

            const deff = deferred();

            const converter = new FfmpegCommand({source: bestQualityVideo.downloadEntry});

            const FIX_WRONG_DURATION_FLAG = '-write_xing 0';
            converter
                .setFfmpegPath(FFMPEG_PATH)
                .outputOptions(FIX_WRONG_DURATION_FLAG);

            converter
                .on('end', deff.resolve)
                .on('error', function (err) {
                    deff.reject(err);
                })
                .saveToFile(outputFilePath);

            return deff.promise;

        }).then(() => {
                console.log("Finished download '" + songTitle + "'");
                completeProcessDef.resolve();
            });

        return completeProcessDef.promise;
    }

    function formatVideoUrl(videoKey) {
        return YOUTUBE_URL + '/watch?v=' + videoKey.replace(/"/g, '');
    }

    function createRejectPromise(error) {
        const errorDef = deferred();
        errorDef.reject(error);
        return errorDef.promise;
    }

    return module;
};

function initCallbacksBehavior() {
    youtubeDl.getInfo = denodeify(youtubeDl.getInfo, Promise, false);

    YoutubeApi = function () {
        const apiInstace = new (require("youtube-node"))();
        apiInstace.search = denodeify(apiInstace.search, Promise, false);

        return apiInstace;
    };

    Promise.onPossiblyUnhandledRejection(function(error){
        throw error;
    });
}
