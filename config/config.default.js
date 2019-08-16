/* eslint valid-jsdoc: "off" */

'use strict';

const path = require('path');

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
    /**
     * built-in config
     * @type {Egg.EggAppConfig}
     **/
    const config = exports = {};

    // use for cookie sign key, should change to your own and keep security
    config.keys = appInfo.name + '_1563443558010_2256';

    // add your middleware config here
    config.middleware = [];

    config.balOneUri = 'http://127.0.0.1:8888/balance/one';
    config.balMultiUri = 'http://127.0.0.1:8888/balance/multi';

    config.mongoose = {
        client: {
            url: 'mongodb://127.0.0.1/tokenskyQuoteDB',
            options: {},
        },
    };

    // 配置mysql
    config.mysql = {
        clients: {
            TokenskyAvatarDB: {
                // 数据库名
                host: "118.31.121.239",
                user: "root",
                password: "root",
                database: 'tokensky',
            },
        },
        // 所有数据库配置的默认值
        default: {
            // host
            host: '127.0.0.1', // 54.179.154.12 139.224.115.73 172.31.21.72
            // 端口号
            port: '3306',
        },

        // 是否加载到 app 上，默认开启
        app: true,
        // 是否加载到 agent 上，默认关闭
        agent: false,
    };

    exports.security = {
        csrf: false
    };

    config.customLogger = {
        recordLogger: {
            file: path.join(appInfo.root, `logs/${appInfo.name}/info-record.log`),
        },
    };

    config.smsInterval = 120

    config.tokenExpire = 30; // token的有效期
    config.tokenSecret = 'YJdark';   // 生成token的签名


    config.qiniuConfig = {
        bucketName: "test1",
        accessKey: 'gPoNjxfS1qvYnbMjccy-UbOzvviIIeOSu5xqCPa7',
        secretKey: "_hcWP1rxzAYaa75KSQGFZulSqbGzTisv4j79vmTx",
        qiniuServer: 'http://test2.hardrole.com/'
    };

    // add your user config here
    const userConfig = {
        // myAppName: 'egg',
    };

    return {
        ...config,
        ...userConfig,
    };
};
