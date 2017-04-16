/**
 * Created by itay on 4/16/2017.
 */

const MESSAGE_SPECIAL_CHARS_MAP = {
    '&#39;':"",
    '&amp;':""
};

function adjustSpecialChars(songTile) {

    let adjustedSongTitle = songTile;
    for (let sc in MESSAGE_SPECIAL_CHARS_MAP) {
        const replaceAllRX = new RegExp(sc, 'g');
        adjustedSongTitle = adjustedSongTitle.replace(replaceAllRX, MESSAGE_SPECIAL_CHARS_MAP[sc]);
    }

    return adjustedSongTitle;
}

module.exports.adjustSpecialChars = adjustSpecialChars;