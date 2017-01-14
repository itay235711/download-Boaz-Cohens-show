/**
 * Created by itay on 1/12/2017.
 */
const _ = require('underscore-node');
const fs = require('fs');
const youtubeDl = require('youtube-dl');
const YoutubeApi = require("youtube-node");
// const Promise = require('promise');
const Promise = require("bluebird");
const denodeify = require('promise-denodeify');
const deferred = require('deferred');

initCallbacksBehavior();

module.exports = function () {
    // public
    const module = {
        setOutputDir: setOutputDir,
        downloadSongsList: downloadSongsList
    };

    // private
    let outputDir;
    const YOUTUBE_URL = 'https://www.youtube.com';

    function setOutputDir(outputDirPath) {
        if (!fs.existsSync(outputDirPath)){
            fs.mkdirSync(outputDirPath);
        }
        outputDir = outputDirPath;
    }

    function downloadSongsList(songsList) {
        if (!songsList || !Array.isArray(songsList)) {
            return;
        }

        for (let i = 0; i < songsList.length; i++) {
            const songTitle = songsList[i];
            downloadSong(songTitle);
        }
    }

    function downloadSong(songTitle) {
        const completeProcessDef = deferred();
        const youtubeApi = new YoutubeApi();
        youtubeApi.setKey('AIzaSyB1OOSpTREs85WUMvIgJvLTZKye4BVsoFU');

        youtubeApi.search(songTitle, 3, function(error, result) {
            if (error) {
                console.log(error);
            }
            else {
                const videoUrls = _.map(result.items, function (itm) {
                    const url = formatVideoUrl(itm.id.videoId);
                    return url;
                });

                const videoDownloadPromises = [];
                _.each(videoUrls, function (url) {
                    const deff = deferred();
                    videoDownloadPromises.push(deff.promise);

                    const downloadEntry = youtubeDl(url, ['-x', '--audio-format', 'mp3']);

                    downloadEntry.on('info', function(info) {
                        deff.resolve({ info : info, downloadEntry : downloadEntry });
                    });
                });

                Promise.all(videoDownloadPromises).then(videosDownload => {

                    let bestQualityVideo = undefined;
                    let bestQualityVideoSize = -1;

                    _.each(videosDownload, function (videosDownload) {
                        if (videosDownload.info.size > bestQualityVideoSize) {
                            bestQualityVideo = videosDownload;
                            bestQualityVideoSize = videosDownload.info.size;
                        }
                    });

                    const outputFilePath = outputDir + '\\' + bestQualityVideo.info.title + '.mp4';
                    const outputStream = fs.createWriteStream(outputFilePath);
                    bestQualityVideo.downloadEntry.pipe(outputStream);

                    const deff = deferred();
                    outputStream.on('finish', deff.resolve);

                    return deff.promise;
                }).then(() => {
                    console.log("Finished download '" + songTitle + "'");
                    completeProcessDef.resolve();
                });
            }
        });

        return completeProcessDef.promise;
    }

    function formatVideoUrl(videoKey) {
        return YOUTUBE_URL + '/watch?v=' + videoKey.replace(/"/g, '');
    }

    return module;
};

function initCallbacksBehavior() {
    youtubeDl.getInfo = denodeify(youtubeDl.getInfo, Promise, false);

    Promise.onPossiblyUnhandledRejection(function(error){
        throw error;
    });
}

