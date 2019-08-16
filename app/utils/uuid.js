"use strict";
const uuidV1 = require('uuid/v1');

module.exports = {
    v1: function() {
        return uuidV1().replace(/\-/g, '');
    }
};
