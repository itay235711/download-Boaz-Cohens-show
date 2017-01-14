/**
 * Created by itay on 1/12/2017.
 */

const ysd = require('./youtube-songs-download-module.js')();
ysd.setOutputDir('C:\\Users\\itay\\home\\7_temp\\boazTestsDir\\');
ysd.downloadSongsList(['A Remark You Made - Weather Report']);