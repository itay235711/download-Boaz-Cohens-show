/**
 * Created by itay on 1/12/2017.
 */
const ysd = require('./youtube-songs-download-module.js')();
const extractor = require('./boaz-cohen-site-extractor.js');
const dateFormat = require('dateformat');

// testSongsDownloader();
testSiteExtractor();

function testSiteExtractor() {

    const todaysDate = dateFormat(new Date(), 'dd.mm.yy');
    extractor.extractShowPlaylist();
}

function testSongsDownloader() {
    ysd.setOutputDir('C:\\Users\\itay\\home\\7_temp\\boazTestsDir\\')
        .setMaxYtSearchResultsNumber(3);

    ysd.downloadSongsList(['בא לי מקופלת', 'yesterday']).then(() => {
        process.exit(0);
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
}
