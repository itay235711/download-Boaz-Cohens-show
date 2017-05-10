/**
 * Created by itay on 4/16/2017.
 */
const Promise = require("bluebird");
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra')
const denodeify = require('promise-denodeify');

initCallbacksBehavior();

module.exports.adjustSongTitle = adjustSongTitle;
module.exports.getTodayFsFriendlyName = getTodayFsFriendlyName;
module.exports.createDirIfNotExists = createDirIfNotExists;
module.exports.moveFileToDir = moveFileToDir;


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

function getTodayFsFriendlyName() {

    const todaysDate = new Date();
    const mm = todaysDate.getMonth() + 1; // getMonth() is zero-based
    const dd = todaysDate.getDate();

    const retDateStr = [
        (mm>9 ? '' : '0') + mm,
        (dd>9 ? '' : '0') + dd,
        todaysDate.getFullYear()
    ].join('_');

    return retDateStr;
}

function createDirIfNotExists(dirPath) {

    let created = false;
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
        created = true;
    }

    return Promise.resolve(created);
}

function moveFileToDir(originalFilePath, newDirPath) {

    const fileName = path.basename(originalFilePath);
    const newFullPath = path.join(newDirPath, fileName);
    const retPromise = fsExtra.move(originalFilePath, newFullPath);

    return retPromise;
}

const MESSAGE_SPECIAL_CHARS_MAP = {
    '&#39;':"",
    '&amp;':"",
    '"':"",
    ":":"",
    "\/":"",
    "\\|":""
};

function initCallbacksBehavior() {
    fsExtra.move = denodeify(fsExtra.move , Promise, false);
}
