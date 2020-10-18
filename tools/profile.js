// from https://gist.github.com/azu/0272ba9020f5e1955cb4
// LICENSE : MIT
"use strict";
// call from node
exports.start = function () {
    global.profile_startTime = Date.now();
};
// call from renderer
exports.stop = function () {
    var ms = Date.now() - require('remote').getGlobal('profile_startTime');
    console.log("profile",  ms + "ms");
};
