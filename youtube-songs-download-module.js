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

initCallbacksBehavoir();

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
        const youtubeApi = new YoutubeApi();
        youtubeApi.setKey('AIzaSyB1OOSpTREs85WUMvIgJvLTZKye4BVsoFU');

        youtubeApi.search(songTitle, 3, function(error, result) {
            if (error) {
                console.log(error);
            }
            else {
                const videosYtKeys = _.map(result.items, function (itm) {
                    return itm.id.videoId;
                });

                // const videoDownload = youtubedl('http://www.youtube.com/watch?v=90AiXO1pAiA',
                //     ['--format=18']);

                const promises = [];
                let bestQualityVideo = { size : -1 };
                _.each(videosYtKeys, function (videoKey) {
                    const videoUrl = formatVideoUrl(videoKey);
                    let info = youtubeDl.getInfo(videoUrl, []);
                    promises.push(info);
                });

                Promise.all(promises).then(function (videoInfosPromises) {
                    let x = 1;
                    throw Error('hi');
                    x = 2;
                }).catch(function (error) {
                    let x = 3;
                });

            // .then(function (err, info) {
            //         if (err)
            //             throw err;
            //
            //         if (info.size > bestQualityVideo.size){
            //             bestQualityVideo = info;
            //         }
            //     });
                var x = 1;
            }
        });

        function formatVideoUrl(videoKey) {
            return YOUTUBE_URL + '/watch?v=' + videoKey.replace(/"/g, '');
        }
    }

    return module;
};
// module.exports;

function initCallbacksBehavoir() {
    youtubeDl.getInfo = denodeify(youtubeDl.getInfo, Promise, false);

    Promise.onPossiblyUnhandledRejection(function(error){
        throw error;
    });
}
