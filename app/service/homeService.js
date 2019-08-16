'use strict';

const Service = require('egg').Service;
const util = require('util');
const dateUtil = require('../utils/dateUtil');
const commonUtil = require('../utils/commonUtil');
const qiniuUtil = require('../utils/qiniu');
const code = require('../utils/code');

const dbName = 'TokenskyAvatarDB';
const table = require('./../../config/constant/table');


class HomeService extends Service {
    /**
         * 
         * @param {*} userId 用户唯一id
         * @param {*} status 订单的状态
         * @param {*} coinType  如果没传参则表示统计全部借贷金额
         */
    async getOrderTotalAmountByStatus(userId, status, symbol) {
        let sql = `
            SELECT SUM(amount) AS totalAmount FROM ${table.BORROW_ORDER} WHERE user_id = ? AND status <= ?
        `;

        let paramList = [userId, status || 1];
        if (symbol) {
            sql += " AND symbol = ?";
            paramList.push(symbol);
        }
        let data = await this.app.mysql.get(dbName).query(sql, paramList);
        if (!data || data.length < 1) {
            return -1;
        }

        return data[0].totalAmount != null ? data[0].totalAmount : 0;
    }

    /// 获取货币借贷产品项目的配置数据
    async getCoinBorrowConfigList(userId) {
        /// 去除相同coin_type的配置
        let sql = `
            SELECT 
                icon, title, coin_type, loan_symbol, MAX(pledge_rate_max) AS pledgeRateMax, MIN(day_rate) AS rate_num 
            FROM ${table.BORROW_CONF}
            WHERE is_putaway = 1 GROUP BY icon, title, coin_type, loan_symbol;
        `;
        let cfgDataList = await this.app.mysql.get(dbName).query(sql);

        let balanList = [];
        for (let i = 0; i < cfgDataList.length; i++) {
            let cfgInfo = cfgDataList[i];
            if (cfgInfo == undefined) { continue; }

            let maxNum = await this.getCoinUsableBorrowMaxAmount(userId, cfgInfo.coin_type, cfgInfo.loan_symbol);
            if (maxNum < 0) {
                console.error('=Balance Err===>balanceNum = %s, symbol =', maxNum, cfgInfo.coin_type)
                maxNum = 0;
            }

            /// 转换图标资源url
            cfgInfo.icon = qiniuUtil.getSignAfterUrl(cfgInfo.icon, this.app.config.qiniuConfig);
            console.log('=BorrowConfig===> maxNum =', maxNum, cfgInfo.coin_type, cfgInfo.title)
            balanList.push({
                icon: cfgInfo.icon,
                title: cfgInfo.title,
                pledgeRateMax: cfgInfo.pledgeRateMax,
                coinType: cfgInfo.coin_type,
                minDayRate: cfgInfo.rate_num,
                pledgeAmount: maxNum,
            })
        }
        return balanList;
    }

    /**
     * 获取单个货币借贷可用最大金额(活期)
     * @param {*} userId 
     * @param {*} symbolStr 质押的货币类型
     * @param {*} loanSymbolStr 借贷的货币类型
     * @param {*} usableBalan 
     */
    async getCoinUsableBorrowMaxAmount(userId, symbolStr, loanSymbolStr, usableBalan) {

        let sql = `
            SELECT MAX(pledge_rate_max) AS rateMax FROM ${table.BORROW_CONF} bc WHERE bc.coin_type = ? AND loan_symbol = ? AND bc.is_putaway = 1
        `;
        /// 获取该货币类型的最高质押率
        let bConfig = await this.app.mysql.get(dbName).query(sql, [symbolStr, loanSymbolStr]);
        if (!bConfig || !bConfig[0]) {
            return -2;
        }

        if (usableBalan == undefined) {
            /// coinType货币的可用余额最多可质押的数额
            usableBalan = await this.service.userService.getUserBalanceByCoinType(userId, symbolStr);
            if (usableBalan < 0) {
                return -3;
            }
        }

        /// 获取该货币类型的当前美金价格
        let pSymbolPirce = await this.service.quoteService.findOneQuoteUSDBySymbol(symbolStr);
        /// 获取USDT的美金价格
        let lSymbolPirce = await this.service.quoteService.findOneQuoteUSDBySymbol(loanSymbolStr);

        /// 可用BTC余额*当前BTC的美金价格*最高质押率/USDT的美金价格, 保留4位小数点
        let num = commonUtil.bigNumberMultipliedBy(usableBalan, pSymbolPirce, 6);
        num = commonUtil.bigNumberMultipliedBy(num, bConfig[0].rateMax, 6);
        num = commonUtil.bigNumberDiv(num, lSymbolPirce, 6);

        return num;
    }

    /**
     * 获取活期账户所有货币借贷可用最大数额(除去 USDT货币)
     * @param {*} userId 
     * @param {*} loanSymbolStr 借贷的货币类型
     */
    async getUserAllUsableBalanceAndBorrowAmount(userId, loanSymbolStr) {
        loanSymbolStr = loanSymbolStr || 'USDT';

        let balanSql = `
            SELECT 
                coin_type, balance, frozen_balance, ubc.avatar 
            FROM
                ${table.TOKENSKY_USER_BALANCE} tub 
            LEFT JOIN ${table.TOKENSKY_USER_BALANCE_COIN} ubc ON ubc.symbol = tub.coin_type 
            WHERE
                tub.user_id = ? AND tub.coin_type != ?
        `;
        let resBalanData = await this.app.mysql.get(dbName).query(balanSql, [userId, loanSymbolStr]);
        if (!resBalanData || resBalanData.length < 1) {
            return [];
        }

        //console.log('====> resBalanData = ', resBalanData)
        let balanceList = [];
        for (let index = 0; index < resBalanData.length; index++) {
            let info = resBalanData[index];
            if (!info) { continue; }

            let cfgSql = `
                SELECT 
                    MAX(pledge_rate_max) AS pledgeRateMax 
                FROM ${table.BORROW_CONF} WHERE coin_type = ? AND is_putaway = 1;
            `;
            let rateMaxNum = 0.7000;
            let cfgData = await this.app.mysql.get(dbName).query(cfgSql, [info.coin_type]);
            if (!!cfgData || cfgData[0] != undefined) {
                rateMaxNum = +cfgData[0].pledgeRateMax || 0.7000;
            }

            let usableBalan = commonUtil.bigNumberPlus(info.balance, info.frozen_balance, 6);
            let resAmountNum = await this.getCoinUsableBorrowMaxAmount(userId, info.coin_type, loanSymbolStr, usableBalan);
            resAmountNum = resAmountNum < 0 ? 0 : resAmountNum;

            info.avatar = qiniuUtil.getSignAfterUrl(info.avatar, this.app.config.qiniuConfig);
            balanceList.push({
                symbol: info.coin_type,
                icon: info.avatar,
                balance: usableBalan || 0,
                amount: resAmountNum,
                pledgeMaxRate: rateMaxNum,
            })
        }
        //console.log('===UserAllUsableBalanceAmount=> balanceList = ', balanceList);
        return balanceList;
    }

}


module.exports = HomeService;
