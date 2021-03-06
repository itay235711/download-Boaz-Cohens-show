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
const projectUtils = require('./utils.js');
const webRequest = require('request').defaults({ encoding: null });
const progressStream = require('progress-stream');
const ProgressBar = require('progress');

initCallbacksBehavior();

module.exports = function () {

    const module = {
        setOutputDir: setOutputDir,
        setMaxYtSearchResultsNumber : setMaxYtSearchResultsNumber,
        setMaxSongFileSizeOptions : setMaxSongFileSizeOptions,
        setMaxSongDurationMinutes : setMaxSongDurationMinutes,
        downloadSongsList: downloadSongsList,
        assignOnSongDownloaded : assignOnSongDownloaded,
        assignOnSongDownloadError : assignOnSongDownloadError
    };

    // public
    function setOutputDir(outputDirPath) {
        _outputDir = outputDirPath;
        return module;
    }

    function setMaxYtSearchResultsNumber(maxNumber) {
        _maxYtSearchResultsNumber = maxNumber;

        return module;
    }

    function setMaxSongFileSizeOptions(options) {
        const TO_BYTES = 1024 * 1024;
        
        if (!options.prefferedSizeLimitMB || !options.maxSizeLimitMB)
            throw "Both 'prefferedSizeLimitMB' and 'maxSizeLimitMB' must have values";

        if (options.prefferedSizeLimitMB > options.maxSizeLimitMB)
            throw 'maxSizeLimitMB max >= prefferedSizeLimitMB';

        _prefferedSongSizeLimitBytes = TO_BYTES * options.prefferedSizeLimitMB;
        _maxSongSizeLimitBytes = TO_BYTES * options.prefferedSizeLimitMB;

        return module;
    }

    function setMaxSongDurationMinutes(durationMinutes) {
        _maxSongDurationSeconds = durationMinutes * 60;

        return module;
    }

    function downloadSongsList(songsList) {
        if (!songsList || !Array.isArray(songsList)) {
            return Promise.reject(new Error("'songsList' must be an array"));
        }
        else {
            let currentPromise = Promise.resolve();
            for (let i = 0; i < songsList.length; i++) {
                const songTitle = songsList[i];
                currentPromise =
                    currentPromise.then(() => downloadSong(songTitle, songsList.length));
            }

            return currentPromise;
        }
    }

    function assignOnSongDownloaded(callback) {
        if (_onSongDownloadedCallback) {
            throw new Error('Only one callback is assignable');
        }
        else {
            _onSongDownloadedCallback = callback;
        }
    }

    function assignOnSongDownloadError(callback) {
        if (_onSongDownloadErrorCallback) {
            throw new Error('Only one callback is assignable');
        }
        else {
            _onSongDownloadErrorCallback = callback;
        }
    }

    // privates
    function downloadSong(songTitle, totalSongsCount) {
        const adjustedSongTitle = projectUtils.adjustSongTitle(songTitle);

        console.log("Starting download song number " + _currentSongNumber +
            " of " + totalSongsCount + ": '" + adjustedSongTitle + "'"
        );
        _currentSongNumber++;

        let downloadChain = searchYtByTitle(adjustedSongTitle)
            .then(searchRes => mapResultsToYtVideosUrls(songTitle, searchRes))
            .then(startDownloadYtVideosUrls)
            .then(chooseVideoToDownload)
            .then(convertVideoToMp3AndOutputToDir)
            .then(songFilePath => setSongMp3Tags(adjustedSongTitle, songFilePath));

        if (_onSongDownloadedCallback) {
            downloadChain = downloadChain.then(() => _onSongDownloadedCallback(adjustedSongTitle));
        }

        downloadChain = downloadChain.then(() => {
            console.log("Download successful.");
            return Promise.resolve();
        });

        downloadChain = downloadChain.catch(e =>{
            console.error("Failed download the song '" + songTitle + "'. error:\n" + e);
            if (!_onSongDownloadErrorCallback) {
                return Promise.resolve();
            }
            else {
                return Promise.resolve(_onSongDownloadErrorCallback(adjustedSongTitle, e));
            }
        });

        return downloadChain;
    }

    function startDownloadYtVideosUrls(videoUrls) {
        const videoDownloadPromises = [];
        _.each(videoUrls, url => {
            const deff = deferred();
            videoDownloadPromises.push(deff.promise);

            const downloadEntry = startNewDownload(url);

            downloadEntry.on('error', err => {
                deff.reject(err);
            });

            downloadEntry.on('info', info => {
                deff.resolve({info: info, downloadEntry: downloadEntry});
            });
        });

        return Promise.all(videoDownloadPromises);
    }

    function startNewDownload(url) {
        return youtubeDl(url, ['--format=18', '--verbose'], {cwd: __dirname, maxBuffer: Infinity});
    }

    function mapResultsToYtVideosUrls(songTitle, searchRes) {
        if (!searchRes.items || searchRes.items.length == 0){
            throw new Error("Did not find results searching '"+ songTitle + "'");
        }

        const videoUrls = searchRes.items.map(itm => formatVideoUrl(itm.id.videoId));

        return Promise.resolve(videoUrls);
    }

    function chooseVideoToDownload(downloadingVideos) {

        const reasonableDurationVideos = _.filter(downloadingVideos,
            video => durationStringToSeconds(video.info.duration) <= _maxSongDurationSeconds
        );

        const prioritizedVideos = _.sortBy(reasonableDurationVideos, video => video.info.view_count).reverse();
        let chosenVideo = _.find(prioritizedVideos, video => video.info.size <= _prefferedSongSizeLimitBytes);
        if (!chosenVideo) {
            chosenVideo = _.find(prioritizedVideos, video => video.info.size <= _maxSongSizeLimitBytes);
        }

        if (!chosenVideo) {
            throw "All the results for the yt search are too large (larger then '" +
                _maxSongSizeLimitBytes + "' configured)";
        }

        return Promise.resolve(chosenVideo);
    }

    function durationStringToSeconds(durationString) {
        let durationSeconds = 0;
        const partsLittleIndia = durationString.split(':').reverse();

        for (let i = 0; i < partsLittleIndia.length; i++) {
            const part = partsLittleIndia[i];
            durationSeconds += part * Math.pow(60, i);
        }

        return durationSeconds;
    }

    function convertVideoToMp3AndOutputToDir(chosenVideo) {

        const outputFileName = projectUtils.adjustSongTitle(chosenVideo.info.title);
        const outputFilePath = path.join(_outputDir, outputFileName) + '.mp3';
        deletePreviousFileIfExists(outputFilePath);

        const progressBarPipe = displayProgressBarPipe('downloading', chosenVideo.info.size);
        const downloadPipe = chosenVideo.downloadEntry.pipe(progressBarPipe);
        const converter = new FfmpegCommand({source: downloadPipe, stdoutLines:0});

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

    function deletePreviousFileIfExists(filePath) {
        if (fs.existsSync(filePath)){
            fs.unlinkSync(filePath);
        }
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
                    success: response => {
                        parseLastfmTrackInfoToMp3Tags(response, songTitleDetails.val)
                            .then(trackTags => def.resolve(trackTags));
                    },
                    error: err => {
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
        retTags.performerInfo = path.parse(_outputDir).name;

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

            retPromise = fetchImageToTag(trackInfo, retTags);
        }

        return retPromise;
    }

    function fetchImageToTag(trackInfo, retTags) {
        let retPromise = Promise.resolve(retTags);
        if (!Array.isArray(trackInfo.album.image)) {
            throw new Error('Expected array of images info, received ' +
                typeof trackInfo.album.image);
        }
        else {
            const largeImageLink = _.find(trackInfo.album.image,
                imageLink => imageLink["#text"] && imageLink.size.toLowerCase() === "large"
            );

            if (largeImageLink) {

                const albumImageTempPath = path.join(_outputDir, retTags.album) + '.png';
                retPromise = downloadFile(largeImageLink["#text"], albumImageTempPath)
                    .then(() => {
                        retTags.image = albumImageTempPath;
                        return retTags;
                      })
                    .catch(err => {
                        console.warn("WARNING: failed downloading image for the album: '" +
                            retTags.album + "'. The  error:\n" + err);

                        if (fs.existsSync(albumImageTempPath)) {
                            fs.unlinkSync(albumImageTempPath);
                        }

                        return retTags;
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

        let detailsArray = songTitle.split('by');
        if (detailsArray.length === 1) {
            detailsArray = songTitle.split('-');
        }

        if (detailsArray.length === 1) {
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

    function downloadFile(uri, filename){

        const def = deferred();
        webRequest.head(uri, () =>
            webRequest(uri).pipe(fs.createWriteStream(filename))
                .on('close', def.resolve)
                .on('error', def.reject)
        );

        return def.promise;
    }

    function displayProgressBarPipe(actionName, totalLength) {
        const displayTemplate = actionName + ' [:bar] :percent :etas';
        const processBar = new ProgressBar(displayTemplate, {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: 100
        });

        const progressBarPipe = progressStream({
                length: totalLength,
                time: 100
            },
            progresion => {
                if (!processBar.complete) {
                    processBar.tick(progresion.percentage);
                }
            }
        );

        return progressBarPipe;
    }

    // members
    let _outputDir;
    let _maxYtSearchResultsNumber = 3;
    let _prefferedSongSizeLimitBytes = 10 * 1024 * 1024;
    let _maxSongDurationSeconds = 30 * 60;
    let _maxSongSizeLimitBytes = _prefferedSongSizeLimitBytes * 4;
    let _onSongDownloadedCallback;
    let _onSongDownloadErrorCallback;
    let _currentSongNumber = 1;
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
        const apiInstance = new (require("youtube-node"))();
        apiInstance.search = denodeify(apiInstance.search, Promise, false);

        return apiInstance;
    };
}
