/**
 * Created by itay on 4/17/2017.
 */

var fs = require('fs');
var http = require('http');

var FFMPEG_DOWNLOAD_URL = 'http://ffmpeg.org/releases/ffmpeg-3.3.tar.bz2';

if (!fs.existsSync('ffmpeg')) {
    console.log('Post install - need to download ffmpeg executable');

    var file = fs.createWriteStream("ffmpeg.bz2");
    var request = http.get(FFMPEG_DOWNLOAD_URL, function(response) {
        response.pipe(file);
        file.on('finish', function () {

        });
    }).on('error', function (err) {
        throw err;
    });
}

process.exit(0);