'use strict';

const Service = require('egg').Service;
const util = require('util');
const dateUtil = require('../utils/dateUtil');
const commonUtil = require('../utils/commonUtil');
const dbName = 'TokenskyAvatarDB';
const table = require('./../../config/constant/table');
const code = require('../utils/code');
const I18nConst = require('../../config/constant/i18n');


class BorrowService extends Service {

    /// 获取我要借贷界面的数据
    async getPledgeCoinAllInfo(userId, symbolStr, pledgeWayNum, financeIdStr) {
        let cfgSql = `
            SELECT 
                id,coin_type,loan_symbol,cycle_month,pledge_rate_max,day_rate 
            FROM 
            ${table.BORROW_CONF} WHERE coin_type = ? AND is_putaway = 1
        `;// GROUP BY coin_type,cycle_month;
        let cfgList = await this.app.mysql.get(dbName).query(cfgSql, [symbolStr]);
        if (!cfgList || cfgList.length < 1) {
            return null;
        }

        let symbolList = [];
        let pledgeList = {};
        /// 解析配置数据
        for (let cfg = 0; cfg < cfgList.length; cfg++) {
            let cInfo = cfgList[cfg];
            if (cInfo == undefined) { continue; }

            if (symbolList.indexOf(cInfo.coin_type) < 0) {
                symbolList.push(cInfo.coin_type);
            }

            /// 去除和 symbolStr 不同的数据
            if (!!symbolStr && cInfo.coin_type != symbolStr) { continue; }

            let obj = {
                id: cInfo.id,
                cycleMonth: cInfo.cycle_month,
                rateMax: cInfo.pledge_rate_max,
                dayRate: cInfo.day_rate,
            }
            if (pledgeList[cInfo.coin_type] == undefined) {
                pledgeList[cInfo.coin_type] = {
                    coinPirce: 0,
                    pledgeWay: 0,
                    usableBalance: 0,
                    usdtAmountMax: 0,
                    pledgeList: []
                }

                let usableBalan = 0;
                if (pledgeWayNum == commonUtil.PLEDGE_WAY.dueOnDemand) {
                    /// 用户coinType货币可用余额
                    usableBalan = await this.service.userService.getUserBalanceByCoinType(userId, cInfo.coin_type);
                }
                else if (pledgeWayNum == commonUtil.PLEDGE_WAY.finance) {
                    /// 指定理财ids的总余额
                    let resBalanNum = await this.service.userService.getFinanceAllBalanceByIds(userId, cInfo.coin_type, financeIdStr);
                    console.log('=========> resBalanNum =', resBalanNum, financeIdStr)
                    if (resBalanNum < 0) {
                        return null;
                    }
                    usableBalan = resBalanNum;
                }
                else {
                    usableBalan = await this.service.userService.getUserBalanceByCoinType(userId, cInfo.coin_type);
                    let resBalanNum = await this.service.userService.getFinanceAllBalanceByIds(userId, cInfo.coin_type);
                    if (resBalanNum < 0) { resBalanNum = 0; }
                    console.log('===> usableBalan =%s, resBalanNum =', usableBalan, resBalanNum)
                    usableBalan = commonUtil.bigNumberPlus(usableBalan, resBalanNum, 6);
                }

                /// coinType货币的可用余额最多可质押的数额
                let maxPledgeAmountNum = await this.service.homeService.getCoinUsableBorrowMaxAmount(userId, cInfo.coin_type, cInfo.loan_symbol, usableBalan);
                maxPledgeAmountNum = maxPledgeAmountNum < 0 ? 0 : maxPledgeAmountNum;

                /// 获取用户已经质押货币的数额
                //let yetAmountNum = await this.service.homeService.getOrderTotalAmountByStatus(userId, 3, cInfo.coin_type);
                /// 当前可用质押的余额减去已质押的数额
                //amountNum = commonUtil.bigNumberMinus(amountNum, yetAmountNum, 6);

                /// 该货币的当前美金价格
                let pSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol(cInfo.coin_type);

                pledgeList[cInfo.coin_type].pledgeWay = pledgeWayNum;
                pledgeList[cInfo.coin_type].coinPirce = pSymbolPrice;
                pledgeList[cInfo.coin_type].usableBalance = usableBalan < 0 ? 0 : usableBalan;
                pledgeList[cInfo.coin_type].usdtAmountMax = maxPledgeAmountNum;
                pledgeList[cInfo.coin_type].pledgeList = [obj];
            }
            else {
                pledgeList[cInfo.coin_type].pledgeList.push(obj);
            }
        }

        let lSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol('USDT');

        return {
            usdtPirce: lSymbolPrice,
            pledgeData: pledgeList,
            symbolList: symbolList
        };
    }

    /**
     * 确定借贷请求
     * @param userId 
     * @param coinType 质押货币类型
     * @param pledgeWay 质押的方式
     * @param financeOrdId 被质押的理财包id(质押方式为理财包时)
     * @param pledgeRate 质押率
     * @param cycleMonth 借贷周期的月数
     * @param amountNum 借贷的金额(USDT数量)
     */
    async createBorrowOrder(userId, symbolStr, loanSymbolStr, pledgeWay, financeOrdId, pledgeRate, cycleMonth, amountNum) {

        let cfgSql = `
            SELECT 
                id AS confId, pledge_rate_max AS rateMax, day_rate AS dayRate, cycle_day AS cycleDay 
            FROM 
                ${table.BORROW_CONF} 
            WHERE is_putaway = 1 AND is_putaway = 1 AND coin_type = ? AND cycle_month = ?`;
        let cfgList = await this.app.mysql.get(dbName).query(cfgSql, [symbolStr, cycleMonth]);
        if (!cfgList || cfgList.length < 1) {
            return {
                success: false,
                msg: 'Params Error',
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS',
            };
        }
        let cfgInfo = cfgList[0];
        console.log('====> cfgInfo =', cfgInfo);

        /// 转换小数点位数
        pledgeRate = commonUtil.bigNumberMultipliedBy(pledgeRate, 1, 4);

        /// 是否超过最大利率或最小利率
        if (pledgeRate > +cfgInfo.rateMax) {
            return {
                success: false,
                msg: 'Pledge Rate Surpass',
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS',
            };
        }

        let expireTime = Date.now() + (cycleMonth * cfgInfo.cycleDay) * 86400 * 1000;
        let expireDate = new Date(expireTime);  ///借贷到期日期
        let curPledgeNum = 0;
        let lSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol(loanSymbolStr);
        let pSymbolPirce = await this.service.quoteService.findOneQuoteUSDBySymbol(symbolStr);

        /// 验证理财包的数据
        if (pledgeWay == commonUtil.PLEDGE_WAY.finance) {
            if (financeOrdId == undefined || !financeOrdId) {
                return {
                    success: false,
                    msg: 'Params FinanceOrdId Error',
                    code: code.ERROR_PARAMS,
                    type: 'ERROR_PARAMS'
                };
            }
            /// 指定理财ids的总余额
            let resBalanNum = await this.service.userService.getFinanceAllBalanceByIds(userId, symbolStr, financeOrdId, expireTime);
            console.log('====> resBalanNum =', resBalanNum)
            if (resBalanNum < 0) {
                return {
                    success: false,
                    msg: 'Params FinanceOrdId Error',
                    code: code.ERROR_PARAMS,
                    type: 'ERROR_PARAMS',
                };
            }
            curPledgeNum = resBalanNum;
        }
        /// 验证活期账户信息
        else if (pledgeWay == commonUtil.PLEDGE_WAY.dueOnDemand) {

            /// 借贷结算价格 = 质押货币美金价格 / USDT美金价格
            let borrowPirceNum = commonUtil.bigNumberDiv(pSymbolPirce, lSymbolPrice, 6);

            /// 质押数量 = 输入的USDT数量 / (质押率 * 借贷结算价格）
            let tempNum = commonUtil.bigNumberMultipliedBy(pledgeRate, borrowPirceNum, 6);
            curPledgeNum = commonUtil.bigNumberDiv(amountNum, tempNum, 6);
            console.log('====> usdtBalance =', lSymbolPrice, pSymbolPirce, pledgeRate, borrowPirceNum, tempNum);

            /// 当前可质押数大于实际要质押的数
            // if (curPledgeNum > pledgeNum) {
            //     return {
            //         success: false,
            //         msg: 'Cur Pledge Num Greater Than PledgeNum',
            //         code: code.ERROR_PARAMS,
            //         type: 'ERROR_PARAMS',
            //     };
            // }

            /// 获取用户质押货币的余额
            let uBalanNum = await this.service.userService.getUserBalanceByCoinType(userId, symbolStr);
            console.log("----> uBalanNum = %s, curPledgeNum =", uBalanNum, curPledgeNum)
            if (uBalanNum < curPledgeNum) {
                return {
                    success: false,
                    msg: 'User Pledge Balance Not Enouth',
                    code: code.ERROR_PARAMS,
                    type: 'ERROR_PARAMS',
                };
            }
        }

        if (curPledgeNum <= 0) {
            return {
                success: false,
                msg: 'Pledge Number For Zero',
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS',
            };
        }
        /// 计算实际的质押率
        let curPledgeRate = this.service.orderService.getCurPledgeRate(curPledgeNum, pSymbolPirce, amountNum, lSymbolPrice);
        let minPledgeRate = this.service.orderService.getCurMinPledgeRate(curPledgeNum, pSymbolPirce, lSymbolPrice);
        console.log('===> curPleRate =', curPledgeRate, cfgInfo.rateMax, minPledgeRate, curPledgeNum)
        if (curPledgeRate > +cfgInfo.rateMax) {
            return {
                success: false,
                msg: 'Pledge Rate Surpass',
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS',
            };
        }

        /// 订单id
        let bOrderId = commonUtil.orderId('08');
        if (!bOrderId) {
            return {
                success: false,
                msg: 'EnsureBorrow 生成orderId 失败',
                code: code.ERROR_SYSTEM,
                type: 'ERROR_SYSTEM',
            };
        }

        let sqlParams = {
            order_id: bOrderId,
            user_id: userId,
            symbol: symbolStr,
            conf_id: cfgInfo.confId,
            pledge_way: pledgeWay,
            //pledge_rate: pledgeRate,
            pledge_amount: curPledgeNum,
            cycle_month: cycleMonth,
            cycle_month_day: cfgInfo.cycleDay,
            pledge_day_rate: cfgInfo.dayRate,
            amount: amountNum,
            loan_symbol: loanSymbolStr || 'USDT',
            status: commonUtil.ORDER_STATUS.using,
            borrow_time: dateUtil.currentDate(),
            expire_time: dateUtil.formatDate(expireDate),
        }

        if (pledgeWay == commonUtil.PLEDGE_WAY.finance) {
            sqlParams.relevance_id = '' + financeOrdId;
            sqlParams.relev_status = 1;
        }

        console.log('====> sqlParams =', sqlParams);
        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务

        try {
            let result = await conn.insert(table.BORROW_ORDER, sqlParams);
            if (result.affectedRows == 0) {
                await conn.rollback();
                return {
                    success: false,
                    msg: 'EnsureBorrow 创建记录数据~~失败',
                    code: code.ERROR_SYSTEM,
                    type: 'ERROR_SYSTEM'
                };
            }

            let tranList = [{ symbol: loanSymbolStr, category: 1, money: amountNum }];
            /// 从活期账户的余额上减去质押的数量
            if (pledgeWay == commonUtil.PLEDGE_WAY.dueOnDemand) {

                let resSubBal = await this.ctx.changeOneBalance(userId, 'sub', curPledgeNum, symbolStr, bOrderId, '借贷', "借贷扣除质押数量");
                console.log('===> resSubBal = ', resSubBal);
                if (!resSubBal.success) {
                    return {
                        success: false,
                        msg: `EnsureBorrow 扣除质押数量~~失败 ${resSubBal.msg}`,
                        code: code.ERROR_SYSTEM,
                        type: 'ERROR_SYSTEM'
                    };
                }

                //tranList.push({ symbol: symbolStr, category: 2, money: curPledgeNum })
            }
            /// 质押货币成功后，将借贷的金额加入到账户余额
            let resAddBal = await this.ctx.changeOneBalance(userId, 'add', amountNum, loanSymbolStr, bOrderId, '借贷', "添加借贷的金额数量");
            console.log('===> resAddBal = ', resAddBal);
            if (!resAddBal.success) {
                await conn.rollback();
                return {
                    success: false,
                    msg: `EnsureBorrow 添加借贷金额~~失败 ${resAddBal.msg}`,
                    code: code.ERROR_SYSTEM,
                    type: 'ERROR_SYSTEM'
                };
            }

            /// 创建交易记录
            let resTrans = await this.service.orderService.createMultitermTransactionOrder(userId, bOrderId, '创建借贷', tranList);
            if (resTrans == false) {
                await conn.rollback();
                return {
                    success: false,
                    msg: `EnsureBorrow 创建交易记录~~失败!`,
                    code: code.ERROR_SYSTEM,
                    type: 'ERROR_SYSTEM'
                };
            }

            /// 当质押方式为理财时记录使用的理财包id
            if (pledgeWay == commonUtil.PLEDGE_WAY.finance) {
                let bUseFinSql = `
                INSERT INTO ${table.BORROW_USE_FINANCIAL_ORDER} (user_id, loan_order_id, financial_id) 
                VALUES 
            `;
                let valueInfo = '';
                let finIds = financeOrdId.split(',');
                let fLength = finIds.length;
                for (let f = 0; f < fLength; f++) {
                    if (finIds[f] == undefined || !finIds[f]) { continue; }
                    valueInfo += "(" + userId + "," + bOrderId + "," + finIds[f] + ")";
                    if (f < fLength - 1) {
                        valueInfo += ",";
                    }
                }
                if (valueInfo.length > 0) {
                    bUseFinSql += valueInfo;
                    let resFinaOrd = await this.app.mysql.get(dbName).query(bUseFinSql);
                    console.log("====> bUseFinSql = ", bUseFinSql, resFinaOrd)
                    if (resFinaOrd.affectedRows == 0) {
                        await conn.rollback();
                        return {
                            success: false,
                            msg: `EnsureBorrow 创建使用理财id记录~~失败!`,
                            code: code.ERROR_SYSTEM,
                            type: 'ERROR_SYSTEM'
                        }
                    }

                }
            }

            let resOperLog = await this.service.orderService.createOperationOrderLog(userId, 'create', bOrderId, pledgeWay, {
                params1: '' + symbolStr,
                params2: '' + curPledgeNum,
                params3: '' + loanSymbolStr,
                params4: '' + amountNum,
                params5: '' + pledgeRate,
                params6: '' + (financeOrdId != undefined ? financeOrdId : ''),
            });
            if (resOperLog == false) {
                await conn.rollback();
                return {
                    success: false,
                    msg: `EnsureBorrow 创建借贷操作记录~~失败!`,
                    code: code.ERROR_SYSTEM,
                    type: 'ERROR_SYSTEM'
                }
            }

            await conn.commit();
            return { success: true, orderId: bOrderId };
        }
        catch (err) {
            await conn.rollback();
            this.ctx.logger.error('createBorrow >>> 逻辑错误,' + err.message);

            return {
                success: false,
                msg: `EnsureBorrow Be Defeated~~!`,
                code: code.ERROR_SYSTEM,
                type: 'ERROR_SYSTEM'
            };
        }
    }

}


module.exports = BorrowService;
