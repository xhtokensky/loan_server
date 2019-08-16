"use strict";
const moment = require('moment');

const DISPLAY_DATE_FORMAT = 'YYYY-MM-DD HH:mm';

const API_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const BIRTHDAY_DATE_FORMAT = 'YYYY-MM-DD';

const PUSH_DATE_FORMAT = 'YYYY-MM-DDTHH:mm';
const UTC_DATE_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSS';

/**
 * 格式化日期，为web端页面显示使用
 * @param date
 * @returns {*}
 */
exports.format = function (date) {
    return moment(date).format(DISPLAY_DATE_FORMAT);
};

exports.currentDate = function () {
    return moment().format(API_DATE_FORMAT);
}

/**
 * 日期格式化
 * @return {[type]} [description]
 */
exports.formatDate = function (date) {
    return moment(date).format(API_DATE_FORMAT);
};

exports.formatBirthday = function (date) {
    return moment(date).format(BIRTHDAY_DATE_FORMAT);
};


exports.numberDate = function () {
    const date = new Date();
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    if (month < 10) month = `0${month}`;
    let day = date.getDate();
    if (day < 10) day = `0${day}`;
    const hours = date.getHours();
    const minute = date.getMinutes();
    const secound = date.getSeconds();
    const millisecond = date.getMilliseconds();
    const numberDate = `${year}${month}${day}${hours}${minute}${secound}${millisecond}`;
    return numberDate;
};


Date.prototype.format = function (format) {
    var date = {
        "M+": this.getMonth() + 1,
        "d+": this.getDate(),
        "h+": this.getHours(),
        "m+": this.getMinutes(),
        "s+": this.getSeconds(),
        "q+": Math.floor((this.getMonth() + 3) / 3),
        "S+": this.getMilliseconds()
    };
    if (/(y+)/i.test(format)) {
        format = format.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (var k in date) {
        if (new RegExp("(" + k + ")").test(format)) {
            format = format.replace(RegExp.$1, RegExp.$1.length == 1
                ? date[k] : ("00" + date[k]).substr(("" + date[k]).length));
        }
    }
    return format;
};

/**
 * 两个时间之间相差天数
 * isAbs 默认为false; 为true,无先后顺序; 为false,日期较大的放前面(date1 > date2)
 * @returns [number]
 */
exports.contrastDateDif = function (date1, date2, isAbs) {

    let leftDate = new Date(date1);
    let rightDate = new Date(date2);

    isAbs = isAbs == undefined ? false : true;
    let diffTime = leftDate.getTime() - rightDate.getTime();
    if (isAbs == true) {
        return Math.ceil(Math.abs(diffTime) / (86400 * 1000));
    }

    if (diffTime < 0) {
        throw ('Error: diffTime Is Negative Number');
    }

    return Math.ceil(diffTime / (86400 * 1000));
}

exports.currentTimestamp = function (date) {
    if (date) {
        return moment(date).valueOf();
    }
    return moment().valueOf();
};