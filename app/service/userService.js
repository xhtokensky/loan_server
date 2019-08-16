'use strict';

const Service = require('egg').Service;
const util = require('util');
const code = require('../utils/code');
const dateUtil = require('../utils/dateUtil');
const I18nConst = require('./../../config/constant/i18n');
const dbName = 'TokenskyAvatarDB';
const table = require('./../../config/constant/table');
const commonUtil = require('../utils/commonUtil');


class UserService extends Service {

    async getUserByUid(userId) {
        let sql = `SELECT yu.*, yut.token
            FROM ${table.TOKENSKY_USER} AS yu
            LEFT JOIN ${table.TOKENSKY_USER_TOKEN} AS yut
            ON yut.user_id=yu.user_id
            WHERE yu.user_id = ?`;
        let userInfo = await this.app.mysql.get(dbName).query(sql, [userId]);
        if (userInfo.length < 1) {
            return null
        }
        return userInfo[0]
    }

    async findOneRoleBlack(balckType, phone) {
        let sql = `select * from ${table.ROLE_BLACK_LIST} where balck_type = ? and phone=? order by end_time desc `;
        let result = await this.app.mysql.get(dbName).query(sql, [balckType, phone]);
        if (result.length < 1) {
            return null;
        }
        return result[0];
    }

    /// 获得用户 symbol 类型的货币可用余额
    async getUserBalanceByCoinType(userId, symbol) {
        let uBalanSql = `
            SELECT 
               balance,frozen_balance 
            FROM
                ${table.TOKENSKY_USER_BALANCE} tub 
            WHERE
                tub.user_id = ? AND tub.coin_type = ?
        `;
        let resData = await this.app.mysql.get(dbName).query(uBalanSql, [userId, symbol]);
        if (!resData || resData.length < 1) {
            return -1;
        }
        /// 用户coinType货币可用余额
        let usableBalan = commonUtil.bigNumberPlus(resData[0].balance, resData[0].frozen_balance, 6);
        return usableBalan;
    }

    /**
     * 获取全部或指定理财id列表的总余额数(本金值)
     * @param {*} userId 
     * @param {*} financeIdStr 
     * @param {*} expireTime 
     */
    async getFinanceAllBalanceByIds(userId, symbolStr, financeIdStr, expireTime) {
        if (!userId || !symbolStr || (!!financeIdStr && util.isString(financeIdStr) == false)) {
            return -1;
        }

        let finaSql = `
            SELECT 
                id,quantity_left FROM ${table.FINANCIAL_ORDER} 
            WHERE 
                user_id = ? AND symbol = ? AND status = 1 AND maturity_time > ?
        `;
        let arrFinaIds = [];
        if (!!financeIdStr) {
            arrFinaIds = financeIdStr.split(',');
            let inSqlStr = '';
            for (let af = 0; af < arrFinaIds.length; af++) {
                if (!arrFinaIds[af] || arrFinaIds[af] == undefined) { continue; }
                inSqlStr = inSqlStr + arrFinaIds[af];
                if (af < arrFinaIds.length - 1) {
                    inSqlStr = inSqlStr + ',';
                }
            }
            if (inSqlStr.length > 0) {
                finaSql = finaSql + ` AND id IN (${inSqlStr})`;
            }
        }
        if (!expireTime || expireTime == undefined) {
            expireTime = Date.now() + (30 * 86400 * 1000); /// 默认为30天时间差
        }
        //console.log('====> expireTime =', expireTime, symbolStr, finaSql);
        let finanList = await this.app.mysql.get(dbName).query(finaSql, [userId, symbolStr, expireTime]);
        if (!finanList || finanList.length < 1) {
            return -2;
        }

        if (!!financeIdStr && arrFinaIds.length != finanList.length) {
            return -3;
        }

        let totalBalanNum = 0;
        /// 统计质押的数量(每个理财包的剩余数量)
        for (let fi = 0; fi < finanList.length; fi++) {
            let fInfo = finanList[fi];
            if (!fInfo || fInfo == undefined) { continue; }
            totalBalanNum = commonUtil.bigNumberPlus(totalBalanNum, fInfo.quantity_left, 6);
        }

        return totalBalanNum;
    }

    /// 获取借贷记录中正在质押的理财包id
    async getUserBorrowFinanceIds(userId, symbolStr, relevStatus) {
        let ordSql = `
        SELECT 
            GROUP_CONCAT(relevance_id) AS relevIdStr 
        FROM ${table.BORROW_ORDER}  WHERE user_id = ? AND symbol = ? AND relev_status = ?
        `;

        console.log('==getUserBorrowFinanceIds==> symbolStr =', symbolStr)
        let orderList = await this.app.mysql.get(dbName).query(ordSql, [userId, symbolStr, relevStatus]);
        if (!orderList || orderList.length < 1) {
            return null;
        }

        console.log('==getUserBorrowFinanceIds==> orderList[0] =', orderList[0])
        return orderList[0].relevIdStr || '';

    }
    /// 验证是否登录
    async __verifyRealAuth(userId) {
        let count = await this.app.mysql.get(dbName).count(table.TOKENSKY_REAL_AUTH, { user_id: userId });
        if (count == 0) {
            return {
                success: false,
                code: code.ERROR_REAL_AUTH_UN,
                type: 'ERROR_REAL_AUTH_UN',
                msg: '未实名认证'
            }
        }
        let count1 = await this.app.mysql.get(dbName).count(table.TOKENSKY_REAL_AUTH, { user_id: userId, status: 1 });
        if (count1 > 0) {
            return {
                success: true
            }
        } else {
            let count2 = await this.app.mysql.get(dbName).count(table.TOKENSKY_REAL_AUTH, { user_id: userId, status: 0 });
            if (count2 > 0) {
                return {
                    success: false,
                    code: code.ERROR_REAL_AUTH_UNCENSORED,
                    type: 'ERROR_REAL_AUTH_UNCENSORED',
                    msg: '您的身份信息审核还未通过，请耐心等待'
                }
            }
            let count3 = await this.app.mysql.get(dbName).count(table.TOKENSKY_REAL_AUTH, { user_id: userId, status: 2 });
            if (count3 > 0) {
                return {
                    success: false,
                    code: code.ERROR_REAL_AUTH_NO,
                    type: 'ERROR_REAL_AUTH_NO',
                    msg: '实名认证审核未通过'
                }
            }
        }
        return {
            success: false,
            code: code.ERROR_REAL_AUTH_UN,
            type: 'ERROR_REAL_AUTH_UN',
            msg: '未实名认证'
        }
    }

    /// 验证是否设置交易密码或密码是否正确
    async __verifyTransactionPassword(userId, body) {
        //是否设置交易密码
        const userInfo = await this.ctx.service.userService.getUserByUid(userId);
        if (!userInfo.transaction_password) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.PleaseSetTransactionPassword),
                code: code.ERROR_SET_PWD,
                type: 'ERROR_SET_PWD'
            };
        }


        if (commonUtil.encrypt(body.transactionPassword) != userInfo.transaction_password) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IncorrectPassword),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }
        return { success: true }
    }
}


module.exports = UserService;
