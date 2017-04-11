/**
 * Created by itay on 1/12/2017.
 */
const ysd = require('./youtube-songs-download-module.js')();
// const extractor = require('./boaz-cohen-site-extractor.js');
const extractor = require('./shazam_gmaillabel_extractor.js');
const dateFormat = require('dateformat');

// testSongsDownloader();
testSiteExtractor();

function testSiteExtractor() {

    extractor.extractShazamLabelNewSongTitles().then(songTitles =>{
        var x = 1;
    });
}

function testSongsDownloader() {
    ysd.setOutputDir('C:\\Users\\itay\\home\\7_temp\\boazTestsDir\\')
        .setMaxYtSearchResultsNumber(3);

    ysd.downloadSongsList(['יהלי סובול - כל יום קצת']).then(() => {
        process.exit(0);
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
}
