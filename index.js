/**
 * Created by itay on 1/12/2017.
 */

const ysd = require('./youtube-songs-download-module.js')();

ysd.setOutputDir('C:\\Users\\itay\\home\\7_temp\\boazTestsDir\\')
    .setMaxYtSearchResultsNumber(3);

ysd.downloadSongsList(['מיליון כוכבים', 'yesterday']).then(() => {
    process.exit(0);
});