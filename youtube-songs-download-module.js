/**
 * Created by itay on 1/12/2017.
 */
const _ = require('underscore-node');
const fs = require('fs');
const path = require('path');
const youtubeDl = require('youtube-dl');
let YoutubeApi;
const Promise = require("bluebird");
const deferred = require('deferred');
const denodeify = require('promise-denodeify');
const FfmpegCommand = require('fluent-ffmpeg');
const nodeID3 = require('node-id3');
const LastFmNode = require('lastfm').LastFmNode;
const merge = require('merge');
const webRequest = require('request').defaults({ encoding: null });

initCallbacksBehavior();

module.exports = function () {

    const module = {
        setOutputDir: setOutputDir,
        setMaxYtSearchResultsNumber : setMaxYtSearchResultsNumber,
        downloadSongsList: downloadSongsList
    };

    // public
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
            return Promise.reject(new Error("'songsList' must be an array"));
        }
        else {
            cleanOutputDir();

            const downloadPromises = [];
            for (let i = 0; i < songsList.length; i++) {
                const songTitle = songsList[i];
                const songPromise = downloadSong(songTitle);
                downloadPromises.push(songPromise);
            }

            return Promise.all(downloadPromises);
        }
    }

    // privates
    function downloadSong(songTitle) {

        return searchYtByTitle(songTitle)
        .then(searchRes => mapResultsToYtVideosUrls(songTitle, searchRes))
        .then(startDownloadYtVideosUrls)
        .then(chooseBestQualityVideo)
        .then(convertVideoToMp3AndOutputToDir)
        .then(songFilePath => setSongMp3Tags(songTitle, songFilePath))
        .then(() => {
            console.log("Finished downloadFile '" + songTitle + "'");
            return Promise.resolve();
        });
    }

    function cleanOutputDir() {
        files = fs.readdirSync(_outputDir);

        for (const file of files) {
            fs.unlinkSync(path.join(_outputDir, file));
        }
    }

    function startDownloadYtVideosUrls(videoUrls) {
        const videoDownloadPromises = [];
        _.each(videoUrls, function (url) {
            const deff = deferred();
            videoDownloadPromises.push(deff.promise);

            const downloadEntry = youtubeDl(url, ['--format=18']);

            downloadEntry.on('info', function (info) {
                deff.resolve({info: info, downloadEntry: downloadEntry});
            });
        });

        return Promise.all(videoDownloadPromises);
    }

    function mapResultsToYtVideosUrls(songTitle, searchRes) {
        if (!searchRes.items || searchRes.items.length == 0){
            throw new Error("Did not find results searching '"+ songTitle + "'");
        }

        const videoUrls = _.map(searchRes.items, function (itm) {
            const url = formatVideoUrl(itm.id.videoId);
            return url;
        });

        return Promise.resolve(videoUrls);
    }

    function chooseBestQualityVideo(videosDownload) {
        let bestQualityVideo = undefined;
        let bestQualityVideoSize = -1;

        _.each(videosDownload, function (videosDownload) {
            if (videosDownload.info.size > bestQualityVideoSize) {
                bestQualityVideo = videosDownload;
                bestQualityVideoSize = videosDownload.info.size;
            }
        });

        return Promise.resolve(bestQualityVideo);
    }

    function convertVideoToMp3AndOutputToDir(bestQualityVideo) {

        const outputFilePath = _outputDir + '\\' + bestQualityVideo.info.title + '.mp3';
        const converter = new FfmpegCommand({source: bestQualityVideo.downloadEntry, stdoutLines:0});

        const FIX_WRONG_DURATION_FLAG = '-write_xing 0';
        converter
            .setFfmpegPath(FFMPEG_PATH)
            .outputOptions(FIX_WRONG_DURATION_FLAG);

        const def = deferred();
        converter
            .on('end', () => def.resolve(outputFilePath))
            .on('error', def.reject)
            .saveToFile(outputFilePath);

        return def.promise;
    }

    function searchYtByTitle(songTitle) {
        const youtubeApi = new YoutubeApi();
        youtubeApi.setKey(YOUTUBE_API_KEY);

        youtubeApi.addParam('type', 'video');
        const searchPromise = youtubeApi.search(songTitle, _maxYtSearchResultsNumber);
        return searchPromise;
    }

    function formatVideoUrl(videoKey) {
        return YOUTUBE_URL + '/watch?v=' + videoKey.replace(/"/g, '');
    }

    function setSongMp3Tags(songTitle, songFilePath) {
        return fetchTrackTags(songTitle)
            .then(trackTags => mergeFileAndTrackTags(songFilePath, trackTags))
            .catch(err => console.warn( // No reason to fail the whole process
                'WARNING - no tags where set to the file "' + songFilePath +
                '" due to the following error:\n' + err)
            );
    }

    function fetchTrackTags(songTitle) {
        const def = deferred();
        const lastfm = getNewLastFmInstance();

        const songTitleDetails = parseSongTitleDetails(songTitle);

        if (songTitleDetails.parsingFailed) {
            def.reject("fetching track info for '" + songTitle + "' failed");
        }
        else {
            lastfm.request("track.getInfo", {
                track: songTitleDetails.val.name,
                artist: songTitleDetails.val.artist,
                handlers: {
                    success: function (response) {
                        parseLastfmTrackInfoToMp3Tags(response, songTitleDetails.val)
                            .then(trackTags => def.resolve(trackTags));
                    },
                    error: function (error) {
                        parseLastfmTrackInfoToMp3Tags({}, songTitleDetails.val)
                            .then(defaultTags => def.resolve(defaultTags));
                    }
                }
            });
        }

        return def.promise;
    }

    function parseLastfmTrackInfoToMp3Tags(lastfmTrackInfoRes, songTitleDetails) {
        const retTags = {};
        let retPromise = Promise.resolve(retTags);

        const trackInfo = lastfmTrackInfoRes.track || {};
        retTags.title = trackInfo.name || songTitleDetails.name;

        if (trackInfo.artist)
            retTags.artist = trackInfo.artist.name;
        else
            retTags.artist = songTitleDetails.artist;

        if (!trackInfo.album || !trackInfo.album.title) {
            retTags.album = songTitleDetails.artist;
        }
        else {
            retTags.album = trackInfo.album.title;

            if (trackInfo.album["@attr"]) {
                retTags.trackNumber = trackInfo.album["@attr"].position;
            }

            retPromise = fetchImageToTag(trackInfo, retPromise, retTags);
        }

        return retPromise;
    }

    function fetchImageToTag(trackInfo, retPromise, retTags) {
        if (!Array.isArray(trackInfo.album.image)) {
            throw new Error('Expected array of images info, received ' +
                typeof trackInfo.album.image);
        }
        else {
            const largeImageLink = _.find(trackInfo.album.image,
                imageLink => imageLink["#text"] && imageLink.size.toLowerCase() === "large"
            );

            if (largeImageLink) {

                const def = deferred();
                retPromise = def.promise;

                const albumImageTempPath = _outputDir + '\\' + retTags.album + '.png';
                downloadFile(largeImageLink["#text"], albumImageTempPath,
                    function success() {
                        retTags.image = albumImageTempPath;
                        def.resolve(retTags);
                    },
                    function error(err) {
                        console.warn("WARNING: failed downloading image for the album: '" +
                            retTags.album + "'. The  error:\n" + err);

                        if (fs.existsSync(albumImageTempPath)) {
                            fs.unlinkSync(albumImageTempPath);
                        }

                        def.resolve(retTags)
                    }
                );
            }
        }
        return retPromise;
    }

    function mergeFileAndTrackTags(songFilePath, trackTags) {

        const fileDefaultTags = nodeID3.read(songFilePath);
        const newSongTags = merge.recursive(true, fileDefaultTags, trackTags);
        // Bug fix
        newSongTags.image = trackTags.image;

        nodeID3.write(newSongTags, songFilePath);

        if (newSongTags.image && fs.existsSync(newSongTags.image)) {
            fs.unlinkSync(newSongTags.image);
        }

        return Promise.resolve();
    }

    function getNewLastFmInstance() {
        return new LastFmNode({
            api_key: '7977ac5a32f72528cbe1bc861b8e88eb',
            secret: 'd33a5c02c44167565ac7515cdaf4adab'
        });
    }

    function parseSongTitleDetails(songTitle) {
        const ret = {};

        const detailsArray = songTitle.split('by');
        if (detailsArray.length == 1) {
            ret.parsingFailed = true;
        }
        else {
            ret.parsingFailed = false;
            ret.val = {
                name: detailsArray[0].trim(),
                artist:detailsArray[1].trim()
            };
        }

        return ret;
    }

    function downloadFile(uri, filename, callback, errorHandler){
        webRequest.head(uri, () =>
            webRequest(uri).pipe(fs.createWriteStream(filename))
                .on('close', callback).on('error', errorHandler)
        );
    }

    // members
    let _outputDir;
    let _maxYtSearchResultsNumber = 3;
    const YOUTUBE_URL = 'https://www.youtube.com';
    const YOUTUBE_API_KEY = 'AIzaSyClAQoAKyT5YLldaOJ2l5mKlhFt76T7UkY';
    const FFMPEG_PATH = '.\\ffmpeg\\ffmpeg-20170112-6596b34-win64-static\\bin\\ffmpeg.exe';

    return module;
};

function initCallbacksBehavior() {
    youtubeDl.getInfo = denodeify(youtubeDl.getInfo, Promise, false);
    fs.readdir = denodeify(fs.readdir, Promise, false);
    fs.unlink = denodeify(fs.unlink, Promise, false);
    fs.writeFile = denodeify(fs.writeFile, Promise, false);

    YoutubeApi = function () {
        const apiInstace = new (require("youtube-node"))();
        apiInstace.search = denodeify(apiInstace.search, Promise, false);

        return apiInstace;
    };

    Promise.onPossiblyUnhandledRejection(function(error){
        throw error;
    });
}
