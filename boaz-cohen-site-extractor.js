/**
 * Created by itay on 1/14/2017.
 */
const Phantom = require('phantom');

module.exports.extractShowPlaylist = extractShowPlaylist;

const _88_FM_SITE_URL = 'http://www.iba.org.il/88fm/';

function extractShowPlaylist(showDate) {
    Phantom.create()
        .then(phantom => phantom.createPage())
        .then(page => {
            return page.open(_88_FM_SITE_URL).then(function () {
                return page;
            });
            promise.then(status => {
                var xx = 1;
                var sss = page;
            });
        })
        .then(function () {

        });
}