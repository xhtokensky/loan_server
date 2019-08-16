"use strict";
const crypto = require('crypto');
const BigNumber = require('bignumber.js');

const CryptoJS = require('crypto-js');

exports.encrypt = function (params, key) {
    var cipher = crypto.createCipher('aes-256-cbc', "tokenKeyabcd1234");
    var crypted = cipher.update(params.toString(), 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
};


exports.decrypt = function (params, key) {
    var decipher = crypto.createDecipher('aes-256-cbc', "tokenKeyabcd1234");
    var dec = decipher.update(params, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
};

/**
 * 客户端交易密码解密
 * @param message
 */
exports.decryptTranPWDByClient = function (message, key) {
    message = decodeURIComponent(message);
    var bytes = CryptoJS.AES.decrypt(message.toString(), '2019tokensky' + key);
    var plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return plaintext;
};

/**
 * 服务端内部加密交易密码
 * @param message
 * @param key
 * @returns {string}
 */
exports.encrypt11 = function (message, key) {
    let iv = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
        0x0e, 0x0f];
    let md5 = crypto.createHash('md5').update('tokensky_' + key + "_tranpwd").digest('hex');
    const cipher = crypto.createCipheriv(
        'aes-128-cbc',
        new Buffer(md5, 'hex'),
        new Buffer(iv)
    );
    var encrypted = cipher.update(message, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
};

/**
 * 服务端内部解密交易密码
 * @param message
 * @param key
 */
exports.decrypt11 = function (message, key) {
    let iv = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
        0x0e, 0x0f];
    let md5 = crypto.createHash('md5').update('tokensky_' + key + "_tranpwd").digest('hex');
    const decipher = crypto.createDecipheriv(
        'aes-128-cbc',
        new Buffer(md5, 'hex'),
        new Buffer(iv)
    );
    var decrypted = decipher.update(message, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

/**
 * 订单生成规则  年(后2位)月日十分秒毫秒+业务码+5位随机数
 * 业务码：00(OTC买入) 01(OTC卖出) 02(购买算力合约) 03(充币) 04(提币) 05(发放合约收益)
 */
exports.orderId = function (code) {
    if (!code) {
        return null;
    }
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
    let numberDate = `${year}${month}${day}${hours}${minute}${secound}${millisecond}`;
    numberDate = numberDate.substring(2, numberDate.length);


    let rand = Math.floor(Math.random() * 90000) + 10000;

    return numberDate + code + rand;
};


/**
 * 加
 * @param x
 * @param y
 * @returns {number}
 */
exports.bigNumberPlus = function (x, y, n) {
    let a = new BigNumber(x);
    let b = new BigNumber(y);
    let c = a.plus(b);
    c = c.toNumber();
    if (n) {
        c = c.toFixed(n);
        c = parseFloat(c);
    }
    return c;
};

/**
 * 减
 * @param x
 * @param y
 * @returns {number}
 */
exports.bigNumberMinus = function (x, y, n) {
    let a = new BigNumber(x);
    a = a.minus(y);
    a = a.toNumber();
    if (n) {
        a = a.toFixed(n);
        a = parseFloat(a);
    }
    return a;
};

/**
 * 乘
 * @param x
 * @param y
 * @returns {number}
 */
exports.bigNumberMultipliedBy = function (x, y, n) {
    let a = new BigNumber(x);
    let b = a.multipliedBy(y);
    b = b.toNumber();
    if (n) {
        b = b.toFixed(n);
        b = parseFloat(b);
    }
    return b;
};

/**
 * 除
 * @param x
 * @param y
 * @returns {number}
 */
exports.bigNumberDiv = function (x, y, n) {
    let a = new BigNumber(x);
    a = a.div(y);
    a = a.toNumber();
    if (n) {
        a = a.toFixed(n);
        a = parseFloat(a);
    }
    return a;
};

/**
 * 字符串内是否有重复的内容
 * @param strData 原字符串内容
 * @param decollator 分隔符
 * @param count 允许出现的次数
 * @param findString 要查找的字符,没有传值的话就查找自己本身内重复的字符
 * @returns {boolean}
 */
exports.stringIsRepetition = function (strData, decollator, count = 1, findString) {
    let s = new String(strData);

    console.log('==stringIsRepetition=> = ', strData, decollator, count, findString)
    let sList = s.split(decollator);
    let obj = {};
    for (let s = 0; s < sList.length; s++) {
        let info = sList[s];
        if (obj[info] == undefined) {
            obj[info] = 1; continue;
        }

        obj[info] = obj[info] + 1;
    }

    let reBool = false;
    for (let key in obj) {
        if ((findString == undefined && obj[key] > count) ||
            (findString && findString == key && obj[key] > count)) {
            reBool = true; break;
        }
    }

    sList = []; sList = undefined;
    obj = {}; obj = undefined;
    return reBool;
};

/// 借贷记录状态
exports.ORDER_STATUS = {
    using: 1,           /// 履行期
    repayDate: 2,       /// 还贷当天
    overdue: 3,         /// 已逾期(过期)
    repayed: 4,         /// 已还贷
    timeout_forceding: 5,       /// 逾期被强平中
    maxrate_forceding: 6,       /// 最大质押率被强平中
    timeout_forcedSell: 7,      /// 逾期被强制出售
    maxrate_forcedSell: 8,      /// 最大质押率被强制出售
}
/// 借贷的方式
exports.PLEDGE_WAY = {
    dueOnDemand: 1,     /// 活期账户
    finance: 2,          /// 理财包
}
