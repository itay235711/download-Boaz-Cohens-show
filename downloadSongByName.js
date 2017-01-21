/**
 * Created by itay on 1/22/2017.
 */

const optimist = require('optimist');
const ysd = require('./youtube-songs-download-module.js')();
const OUTPUT_DIR = 'C:\\Users\\itay\\Music\\2_youtube_instant\\';
const cp = require('child_process');

function main() {
    const songTitle = extractTitleFromAppArgs();
    downloadSongByTitle(songTitle);
}

function extractTitleFromAppArgs() {
    const argv = optimist
        .usage('Usage: node $0 --title=[song title]')
        .demand(['title'])
        .argv;

    return argv.title;
}

function downloadSongByTitle(songTitle) {
    ysd.setOutputDir(OUTPUT_DIR);
    ysd.downloadSongsList([songTitle]).then(() => {
        cp.exec('start "" "' + OUTPUT_DIR + '"',
            () => process.exit(0)
        );
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
}

main();