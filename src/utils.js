/**
 * Created by itay on 4/16/2017.
 */

module.exports.adjustSpecialChars = adjustSongTitle;

function adjustSongTitle(songTile) {
    let adjustedSongTitle = adjustSpecialChars(songTile);
    adjustedSongTitle = removeParenthesisParts(adjustedSongTitle);

    return adjustedSongTitle;
}

function adjustSpecialChars(songTile) {
    let adjustedSongTitle = songTile;
    for (let sc in MESSAGE_SPECIAL_CHARS_MAP) {
        const replaceAllRX = new RegExp(sc, 'g');
        adjustedSongTitle = adjustedSongTitle.replace(replaceAllRX, MESSAGE_SPECIAL_CHARS_MAP[sc]);
    }

    return adjustedSongTitle;
}

function removeParenthesisParts(adjustedSongTitle) {
    const rx = new RegExp("\\(.*?\\)", 'g');
    const ret = adjustedSongTitle.replace(rx, "");

    return ret;
}

const MESSAGE_SPECIAL_CHARS_MAP = {
    '&#39;':"",
    '&amp;':"",
    '"':"",
    ":":"",
    "/":"",
    "\/":"",
    "\\|":""
};
