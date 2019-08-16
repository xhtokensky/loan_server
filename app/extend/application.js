// this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
const moment = require('moment');
moment.locale('zh-cn');
const crypto = require('crypto');
const inviteCode = require('invite-code');
const jwt = require('jsonwebtoken');

module.exports = {
    /**
     * 代码延迟
     */
    async sleep(numberMillis) {
        let now = new Date();
        let exitTime = now.getTime() + numberMillis;
        while (true) {
            let now1 = new Date();
            if (now1.getTime() > exitTime) {
                return await true;
            }
        }
    },
    /**
     * 更具日期获取对应的日期格式
     * @param {*int O} type
     * @param {*Data M} date
     */
    getDateStringByDate(type = 1, date) {
        let year = date.getFullYear();
        let month = (date.getMonth()) + 1;
        let day = date.getDate();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let seconds = date.getSeconds();
        let milliSeconds = date.getMilliseconds();
        if (month < 10) {
            month = "0" + month;
        }
        if (day < 10) {
            day = "0" + day;
        }
        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (type == 2) {
            return "" + year + "-" + month + "-" + day;
        }
        if (type == 3) {
            return "" + year + "-" + month;
        }
        if (type == 4) {
            return "" + year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds;
        }
        return "" + year + "" + month + day + hours + minutes + seconds + milliSeconds;
    },
    // 公共函数 生成6位随机码
    randomCode() {
        let codeArr = [];
        // 用来生成4个随机数
        while (codeArr.length < 6) {
            let newNum = Math.floor(Math.random() * 10);
            codeArr.push(newNum);
        }
        return codeArr.join('');
    },
    // 公共函数  检测手机短信验证码是否合法
    checkCaptchaCode(timestamp) {
        let interval = this.config.smsInterval; // 有效时间内
        let currentUnix = moment(Date.now()).format('X'); // 当前服务器时间戳
        let s = currentUnix - timestamp;
        if (s > interval) { // 超过60秒 ，验证失效
            return false;
        } else {
            return true;
        }
    },
    //  公共函数 密码加密
    encryption(password) {
        const newpassword = this.Md5(this.Md5(password).substr(2, 7) + this.Md5(password));
        return newpassword
    },
    // 公共函数
    Md5(password) {
        const md5 = crypto.createHash('md5');
        return md5.update(password).digest('base64');
    },
    // 生成邀请ID
    makeInvite(uid) {
        return this.inviteCodeCreator().encode(uid);
    },
    inviteCodeCreator() {
        const arr = [
            93, 41, 62, 5, 75, 24, 49, 60, 27, 78,
            12, 68, 2, 3, 58, 37, 85, 65, 0, 72,
            40, 48, 67, 73, 33, 91, 51, 59, 87, 28,
            77, 95, 9, 13, 79, 15, 25, 21, 96, 31,
            38, 16, 64, 86, 90, 43, 57, 52, 1, 66, 29,
            74, 92, 83, 34, 10, 32, 7, 19, 35, 80,
            69, 42, 45, 44, 18, 56, 70, 6, 22,
            99, 55, 71, 36, 14, 81, 53, 82, 88, 63,
            61, 84, 98, 94, 39, 97, 54, 30, 50, 23,
            4, 26, 89, 76, 11, 46, 8, 20, 47, 17
        ];
        //make an creator by your config.the '5' is min length of your invite-code.
        //创建一个生成器，第二个参数'5'表示 创建的邀请码至少6位数字。
        return inviteCode(arr, 6);
    },
    /**
     * 生成token
     * @param {*} uid       用户ID
     */
    signToken(uid, deviceId) {
        return jwt.sign({uid: uid},
            this.config.tokenSecret,
            {expiresIn: 60 * 60 * 24 * this.config.tokenExpire});
    },
    /**
     * 根据类型返回不同的格式
     * @param {*Int O} type
     */
    getDateString(type = 1) {
        let date = new Date();
        let year = date.getFullYear();
        let month = (date.getMonth()) + 1;
        let day = date.getDate();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let seconds = date.getSeconds();
        let milliSeconds = date.getMilliseconds();
        if (month < 10) {
            month = "0" + month;
        }
        if (day < 10) {
            day = "0" + day;
        }
        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (type == 2) {
            return "" + year + "" + month + day;
        }
        if (type == 3) {
            return "" + year + "-" + month;
        }
        return "" + year + "" + month + day + hours + minutes + seconds + milliSeconds;
    },
    /**
     * 生成唯一流水号，设备加时间戳
     * @param {*String M} source 来源
     * @param {*Int M} userId 用户ID
     * @param {*String M} type 类型
     * return String 用户ID+来源+日期（精确到毫秒）+ 类型买还是卖
     */
    setUniqueSerialNumber(source, userId, type) {
        return userId + source + this.getDateString() + type;
    },
    // 16进制转10进制
    sanitizeHex(hex) {
        hex = hex.substring(0, 2) == '0x' ? hex.substring(2) : hex;
        if (hex == "") return "";
        return '0x' + this.padLeftEven(hex);
    },
    padLeftEven(hex) {
        hex = hex.length % 2 != 0 ? '0' + hex : hex;
        return hex;
    },
    convertImageToBase64(url) {
        let http = require('http');
        return new Promise(function (resolve, reject) {
            if (!url) {
                reject(null);
            }
            let urlheader = url.split(':')[0];
            if (urlheader == 'http') {
                http = require('http');
            }
            if (urlheader == 'https') {
                http = require('https');
            }
            try {
                http.get(url, function (res) {
                    let chunks = [];
                    let size = 0;
                    res.on('data', function (chunk) {
                        chunks.push(chunk);
                        size += chunk.length;　　//累加缓冲数据的长度
                    });
                    res.on('end', function (err) {
                        let data = Buffer.concat(chunks, size);
                        let base64Img = data.toString('base64');
                        resolve(base64Img);
                    });
                });
            } catch (e) {
                console.error(`convertImageToBase64 error : ${e.message}`);
                reject(null)
            }
        });
    }
};
