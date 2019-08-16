'use strict';

const Service = require('egg').Service;
const util = require('util');
const qiniuUtil = require('../utils/qiniu');
const commonUtil = require('../utils/commonUtil');
const dateUtil = require('../utils/dateUtil');
const dbName = 'TokenskyAvatarDB';
const table = require('./../../config/constant/table');
const code = require('../utils/code');
const I18nConst = require('../../config/constant/i18n');


class OrderService extends Service {

    __returnObj(resNum) {
        if (resNum == -1) {
            return {
                success: false,
                code: code.ERROR_ORDER_NOT_EXIST,
                msg: 'ERR: 借贷记录不存在~',
                type: 'ERROR_ORDER_NOT_EXIST'
            };
        }
        else if (resNum == -2) {
            return {
                success: false,
                code: code.ERROR_ORDER_STATUS_ERR,
                msg: 'ERR: 借贷记录状态错误~',
                type: 'ERROR_ORDER_STATUS_ERR'
            };
        }
        else if (resNum == -3) {
            return {
                success: false,
                code: code.ERROR_ORDER_TIME_OUT,
                msg: 'ERR: 借贷记录已过期~',
                type: 'ERROR_ORDER_TIME_OUT'
            }
        }
    }

    /// 质押货币的当前质押率
    getCurPledgeRate(pledgeNum, pledgePrice, borrowNum, borrowPrice) {

        /// 质押率 =((USDT的美金价格 * USDT数量)/(当前质押货币的美金价格 * 质押货币数额) )
        /// 质押率 = ( 输入的USDT数量 / (质押数量 * 借贷结算价格）)* 100
        if (!pledgeNum || !borrowNum || !pledgePrice || !borrowPrice) {
            return -1;
        }

        //console.log('getCurPledgeRate--> priceNum =', pledgeNum, pledgePrice, borrowNum, borrowPrice)
        let endPrice = commonUtil.bigNumberDiv(pledgePrice, borrowPrice, 6);
        let fenMu = commonUtil.bigNumberMultipliedBy(pledgeNum, endPrice, 6);

        return commonUtil.bigNumberDiv(borrowNum, fenMu, 4);
    }

    /// 质押货币的当前最小质押率
    getCurMinPledgeRate(symbolBalance, symbolPrice, borrowPrice) {
        /// 公式： 质押率 = ( 输入的USDT数量 / (质押数量 * 借贷结算价格）)* 100
        let borrowMinNum = 1000;
        /// 借贷结算价
        let endPrice = commonUtil.bigNumberDiv(symbolPrice, borrowPrice, 6);

        let fenMu = commonUtil.bigNumberMultipliedBy(symbolBalance, endPrice, 6);

        return commonUtil.bigNumberDiv(borrowMinNum, fenMu, 4);
    }
    /**
     * 获取用户质押货币为symbol的所有借贷记录
     * @param {*} userId 
     * @param {*} symbolStr 质押货币类型 
     * @param {*} lableIndex 1 使用中 2 还贷日 3 强平中 4 已结清(已还款和已强平)
     */
    async getUserOrderList(userId, symbolStr, lableIndex) {

        let ordSql = `
            SELECT bo.order_id,bo.symbol,bo.loan_symbol,bo.pledge_amount,bo.amount,bo.status,bo.cycle_month,bo.cycle_month_day,bo.pledge_day_rate,bo.borrow_time,bo.expire_time, bo.repay_time, bo.forceding_time,bo.repay_interest, ubc.avatar 
            FROM ${table.BORROW_ORDER} bo 
            LEFT JOIN ${table.TOKENSKY_USER_BALANCE_COIN} ubc ON ubc.symbol = bo.symbol 
            WHERE bo.user_id = ? AND bo.symbol = ?
        `;
        let ordList = await this.app.mysql.get(dbName).query(ordSql, [userId, symbolStr]);
        if (!ordList || ordList.length < 0) {
            return null;
        }

        let resList = [];
        let curDate = new Date();
        let curDateStr = dateUtil.formatBirthday(curDate);
        let symbolPirceObj = {};      /// 所有货币的美金价格
        let updateOrder = [];
        for (let o = 0; o < ordList.length; o++) {
            let oInfo = ordList[o];
            if (oInfo == undefined) { continue; }

            const conBorrowTime = new Date(oInfo.borrow_time).getTime();
            const conExpireTime = new Date(oInfo.expire_time).getTime();
            const conRepayTime = new Date(oInfo.repay_time).getTime();
            const conForceTime = new Date(oInfo.forceding_time).getTime();

            if (oInfo.status < commonUtil.ORDER_STATUS.repayed) {

                /// 是否到强平条件
                /// 该货币的当前美金价格
                if (symbolPirceObj[oInfo.symbol] == undefined) {
                    symbolPirceObj[oInfo.symbol] = await this.service.quoteService.findOneQuoteUSDBySymbol(oInfo.symbol);
                }
                if (symbolPirceObj[oInfo.loan_symbol] == undefined) {
                    symbolPirceObj[oInfo.loan_symbol] = await this.service.quoteService.findOneQuoteUSDBySymbol(oInfo.loan_symbol);
                }

                let curPleRate = this.getCurPledgeRate(oInfo.pledge_amount, symbolPirceObj[oInfo.symbol], oInfo.amount, symbolPirceObj[oInfo.loan_symbol]);
                /// 订单状态的修改
                let diffTimeNum = conExpireTime - curDate.getTime();
                if (diffTimeNum > 0 && diffTimeNum <= 86400 * 1000) {
                    oInfo.status = commonUtil.ORDER_STATUS.repayDate;
                }

                /// 是否超过最大的质押率
                if (curPleRate >= 0.9000) {
                    oInfo.status = commonUtil.ORDER_STATUS.maxrate_forceding;
                }
                else if (conExpireTime < curDate.getTime()) {
                    /// 是否到逾期的强平条件
                    oInfo.status = commonUtil.ORDER_STATUS.timeout_forceding;
                }
            }
            /// 转换图标资源url
            let coinPath = qiniuUtil.getSignAfterUrl(oInfo.avatar, this.app.config.qiniuConfig);

            let pushObj = {
                orderId: oInfo.order_id,
                icon: coinPath,
                symbol: oInfo.symbol,
                amount: oInfo.amount,
                status: oInfo.status,
                borrowTime: conBorrowTime,
            }

            console.log('====> oInfo.status =', oInfo.status, lableIndex)
            if ((lableIndex == 1 && oInfo.status == commonUtil.ORDER_STATUS.using) ||
                (lableIndex == 2 && oInfo.status == commonUtil.ORDER_STATUS.repayDate)) {
                /// 借贷整个周期产生的利息 = 借贷周期(天数) * 日利率 * 借贷USDT金额(本金)
                let totalInterest = commonUtil.bigNumberMultipliedBy((oInfo.cycle_month * oInfo.cycle_month_day), oInfo.pledge_day_rate, 6);
                totalInterest = commonUtil.bigNumberMultipliedBy(totalInterest, oInfo.amount, 6);

                pushObj.interest = totalInterest;
                pushObj.expireTime = conExpireTime;
            }
            else if (lableIndex == 3 && (oInfo.status == commonUtil.ORDER_STATUS.timeout_forceding ||
                oInfo.status == commonUtil.ORDER_STATUS.maxrate_forceding)) {
                /// 借贷整个周期产生的利息 = 借贷周期(天数) * 日利率 * 借贷USDT金额(本金)
                let totalInterest = commonUtil.bigNumberMultipliedBy((oInfo.cycle_month * oInfo.cycle_month_day), oInfo.pledge_day_rate, 6);
                totalInterest = commonUtil.bigNumberMultipliedBy(totalInterest, oInfo.amount, 6);

                pushObj.interest = totalInterest;
                pushObj.expireTime = conForceTime;
            }
            else if (lableIndex == 4 && (oInfo.status == commonUtil.ORDER_STATUS.repayed ||
                oInfo.status >= commonUtil.ORDER_STATUS.timeout_forcedSell)) {

                pushObj.interest = oInfo.repay_interest;
                pushObj.expireTime = conRepayTime;
            }
            else {
                continue;
            }
            resList.push(pushObj);
        }

        return resList;
    }

    /**
     * 获取借贷记录的详情
     * @param userId
     * @param orderId 
     */
    async getOrderDetailsById(userId, orderId) {

        let verResData = await this.__verifyOrderData(userId, orderId);
        //console.log('==getOrderDetailsById====> verResData = ', verResData);
        if (!verResData || verResData < 0) {
            return this.__returnObj(verResData);
        }

        let orderInfo = verResData;

        const conBorrowTime = dateUtil.formatBirthday(orderInfo.borrow_time);

        /// 借贷整个周期产生的利息 = 借贷周期(天数) * 日利率 * 借贷USDT金额(本金)
        let totalInterest = commonUtil.bigNumberMultipliedBy((orderInfo.cycle_month * orderInfo.cycle_month_day), orderInfo.pledge_day_rate, 6);
        totalInterest = commonUtil.bigNumberMultipliedBy(totalInterest, orderInfo.amount, 6);

        let resObj = {
            orderId: orderInfo.order_id,
            icon: orderInfo.avatar,
            symbol: orderInfo.symbol,
            loanSymbol: orderInfo.loan_symbol,
            pledgeAmount: orderInfo.pledge_amount,
            pledgeRate: orderInfo.pledgeRate || 0,
            pledgeWay: orderInfo.pledge_way,
            cycleMonth: orderInfo.cycle_month * orderInfo.cycle_month_day,
            amount: orderInfo.amount,
            interest: totalInterest,
            status: orderInfo.status,
            borrowTime: conBorrowTime,     ///转换过
            surplusDay: orderInfo.surplusDay || 0,
            //expireTime: conExpireTime
        };

        //console.log('==getOrderDetailsById====>resObj = ', resObj);
        return { success: true, resObj: resObj };
    }

    /// 用户的还贷界面
    async getRepayBorrowPageData(userId, orderId) {

        let verResData = await this.__verifyOrderData(userId, orderId, commonUtil.ORDER_STATUS.overdue);
        if (!verResData || verResData < 0) {
            return this.__returnObj(verResData);
        }
        let orderInfo = verResData;

        let curTime = Date.now();
        //let curDateStr = dateUtil.formatBirthday();
        let borrowTime = new Date(orderInfo.borrow_time).getTime(); /// 开始借贷日期
        /// 计算从借贷日到今天所产生的利息
        let diffDay = dateUtil.contrastDateDif(curTime, borrowTime);
        let totalInterestNum = commonUtil.bigNumberMultipliedBy(diffDay, orderInfo.pledge_day_rate, 6);
        totalInterestNum = commonUtil.bigNumberMultipliedBy(totalInterestNum, orderInfo.amount, 6);

        let usdtBalance = await this.service.userService.getUserBalanceByCoinType(userId, orderInfo.loan_symbol);
        console.log('==getRepayBorrowPageData==>diffDay =', diffDay, orderInfo.amount, totalInterestNum)
        return {
            success: true,
            resObj: {
                amount: orderInfo.amount,   /// 借贷金额
                interest: totalInterestNum, /// 借贷利息
                overdue_interest: 0,        /// 逾期利息
                service_charge: 0,          /// 手续费
                order_id: orderId,          /// 借贷记录id
                symbol_balance: usdtBalance,/// 借贷货币的余额
            }
        }
    }
    /**
     * 用户还款
     * @param {*} userId 
     * @param {*} orderId 
     */
    async repayBorrow(userId, orderId) {

        let verResData = await this.__verifyOrderData(userId, orderId, commonUtil.ORDER_STATUS.overdue);
        if (!verResData || verResData < 0) {
            return this.__returnObj(verResData);
        }
        let orderInfo = verResData;

        let curTime = Date.now();
        let curDateStr = dateUtil.formatBirthday();
        let expDateStr = dateUtil.formatBirthday(orderInfo.expire_time);
        let expireTime = new Date(orderInfo.expire_time).getTime(); /// 最后还款日期
        let borrowTime = new Date(orderInfo.borrow_time).getTime(); /// 开始借贷日期

        let cycleDiffDay = dateUtil.contrastDateDif(expireTime, borrowTime);
        let bufferTime = 86400 * 1000;  ///系统减去还款的缓冲时间(目前是1天)

        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {
            /// 当天或提前还款
            if (expireTime - bufferTime >= curTime) {
                let diffDay = dateUtil.contrastDateDif(curTime, borrowTime);
                console.log('====1111====> orderInfo = ', diffDay, cycleDiffDay);
                /// 得出还款当天之前的总利息(USDT货币)
                let totalInterestNum = commonUtil.bigNumberMultipliedBy(diffDay, orderInfo.pledge_day_rate, 6);
                totalInterestNum = commonUtil.bigNumberMultipliedBy(totalInterestNum, orderInfo.amount, 6);
                /// 从账户上扣除本金和所产生的利息
                let deductAmount = commonUtil.bigNumberPlus(orderInfo.amount, totalInterestNum, 6);


                let setSql = "SET status = ?, repay_time = ?, repay_interest = ?";
                if (orderInfo.pledge_way == commonUtil.PLEDGE_WAY.finance) {
                    setSql += ", relev_status = 2";
                }
                let bOrdSql = `UPDATE ${table.BORROW_ORDER} ${setSql} WHERE user_id = ? AND order_id = ?`;

                console.log('=33333==> bOrdSql = ', bOrdSql);
                /// 修改借贷记录相关数据
                let ordResData = await conn.query(bOrdSql, [commonUtil.ORDER_STATUS.repayed, curDateStr, totalInterestNum, userId, orderId]);
                if (ordResData.affectedRows == 0) {
                    await conn.rollback();
                    return {
                        success: false,
                        code: code.ERROR_UPDATE_DATA,
                        msg: 'RepayBorrow,,ERR: 更新记录错误~',
                        type: 'ERROR_UPDATE_DATA'
                    };
                }

                /// 删除borrow_use_financial_order表里的理财包id
                if (orderInfo.pledge_way == commonUtil.PLEDGE_WAY.finance) {
                    orderInfo.pledge_amount = 0;  ///理财时无需将质押数归还到活期账户

                    let delFinaIdSql = `
                    DELETE FROM ${table.BORROW_USE_FINANCIAL_ORDER} WHERE user_id = ? AND loan_order_id = ? AND financial_id IN (${orderInfo.relevance_id})
                `;

                    //console.log('===> delFinaIdSql = ', orderInfo.relevance_id, delFinaIdSql)
                    let resDelFina = await conn.query(delFinaIdSql, [userId, orderId]);
                    //console.log('===> resDelFina = ', resDelFina);
                    if (resDelFina.affectedRows == 0) {
                        await conn.rollback();
                        return {
                            success: false,
                            msg: `RepayBorrow 删除记录使用的理财id~~失败 ${resAllBal.msg}`,
                            code: code.ERROR_SYSTEM,
                            type: 'ERROR_SYSTEM'
                        };
                    }
                }

                let changeList = [
                    { changeNum: deductAmount, method: 'sub', symbol: orderInfo.loan_symbol, signId: orderId }
                ];
                let tranList = [
                    { symbol: orderInfo.loan_symbol, category: 2, money: deductAmount },
                ]

                /// 质押方式为活期时
                if (orderInfo.pledge_way == commonUtil.PLEDGE_WAY.dueOnDemand && orderInfo.pledge_amount > 0) {
                    changeList.push({ changeNum: orderInfo.pledge_amount, method: 'add', symbol: orderInfo.symbol, signId: orderId });

                    //tranList.push({ symbol: orderInfo.symbol, category: 1, money: orderInfo.pledge_amount });
                }

                let resAllBal = await this.ctx.changeAllBalance(userId, changeList, '还款', "还贷扣除本息金额以及增加质押的货币数量");
                console.log('===> resAllBal = ', resAllBal);
                if (!resAllBal.success) {
                    await conn.rollback();
                    return {
                        success: false,
                        msg: `RepayBorrow 扣除本金利息数量~~失败 ${resAllBal.msg}`,
                        code: code.ERROR_SYSTEM,
                        type: 'ERROR_SYSTEM'
                    };
                }

                /// 创建操作借贷记录的log
                let resOper = await this.createOperationOrderLog(userId, 'repay', orderId, orderInfo.pledge_way, {
                    params1: '' + orderInfo.loan_symbol,
                    params2: '' + orderInfo.amount,
                    params3: '' + totalInterestNum,
                    params4: '' + diffDay,
                    params5: '' + orderInfo.pledge_amount,
                    params6: '' + (orderInfo.relevance_id != undefined ? orderInfo.relevance_id : ''),
                });
                if (resOper == false) {
                    await conn.rollback();
                    return {
                        success: false,
                        code: code.ERROR_ADD_DATA,
                        msg: 'RepayBorrow 创建借贷操作log失败~',
                        type: 'ERROR_ADD_DATA'
                    };
                }

                /// 创建交易记录
                let resTrans = this.createMultitermTransactionOrder(userId, orderId, '借贷还款', tranList);
                if (resTrans == false) {
                    await conn.rollback();
                    return {
                        success: false,
                        code: code.ERROR_ADD_DATA,
                        msg: 'RepayBorrow 创建交易记录失败~',
                        type: 'ERROR_ADD_DATA'
                    };
                }
            }

            await conn.commit();
            console.log('========> orderInfo = ', curDateStr, expDateStr, expireTime, borrowTime);
            return { success: true }
        } catch (err) {
            await conn.rollback();
            this.ctx.logger.error('repayBorrow >>> 逻辑错误,' + err.message);
            return {
                success: false,
                code: code.ERROR_SYSTEM,
                msg: 'RepayBorrow Be Defeated~~!',
                type: 'ERROR_SYSTEM'
            };
        }
    }

    /**
     * 追加质押数
     * @param {*} userId 
     * @param {*} orderId 借贷记录的id
     * @param {*} addPledgeNum 要增加质押的数量
     * @param {*} pledgeRate 前端计算的当前质押率
     * @param {*} financeIdStr 增加的理财包id 
     */
    async addBorrowPledgeAmount(userId, orderId, addPledgeNum, pledgeRate, financeIdStr) {
        /// 验证借贷记录信息
        let verResData = await this.__verifyOrderData(userId, orderId, commonUtil.ORDER_STATUS.overdue);
        if (!verResData || verResData < 0) {
            return this.__returnObj(verResData);
        }

        let orderInfo = verResData;

        let setSql = "SET add_pledge_time = ?, pledge_amount = ?";
        let arrParams = [dateUtil.currentDate()];
        let newPledgeNum = 0;
        let useFinValueInfo = '';       /// 记录增押使用的理财包id

        if (orderInfo.pledge_way == commonUtil.PLEDGE_WAY.finance &&
            util.isString(financeIdStr) == true) {
            /// 判断是否有质押中的理财包id
            let idsList = financeIdStr.split(',');
            console.log('==1111111111=>idsList = ', idsList)
            for (let index = 0; index < idsList.length; index++) {
                if (!idsList[index]) { continue; }
                let resBool = commonUtil.stringIsRepetition(orderInfo.relevance_id, ',', 1, idsList[index]);
                if (resBool == true) {
                    return {
                        success: false,
                        msg: 'Params FinanceOrdId Repetition',
                        code: code.ERROR_PARAMS,
                        type: 'ERROR_PARAMS',
                    };
                }
                useFinValueInfo += "(" + userId + "," + orderId + "," + idsList[index] + ", 2)";
                if (index < idsList.length - 1) {
                    useFinValueInfo += ",";
                }
            }
            /// 指定理财ids的总余额(本金值)
            let resPledgeNum = await this.service.userService.getFinanceAllBalanceByIds(userId, orderInfo.symbol, financeIdStr);
            console.log('==11111==> resPledgeNum =', resPledgeNum)
            if (resPledgeNum <= 0 || resPledgeNum != addPledgeNum) {
                return {
                    success: false,
                    msg: 'Params Finance Balance Error',
                    code: code.ERROR_PARAMS,
                    type: 'ERROR_PARAMS',
                };
            }

            setSql += ", relevance_id = ?";
            newPledgeNum = commonUtil.bigNumberPlus(orderInfo.pledge_amount, addPledgeNum, 6);

            if (orderInfo.relevance_id && orderInfo.relevance_id.length > 0) {
                orderInfo.relevance_id += "," + financeIdStr;
            } else {
                orderInfo.relevance_id = "" + financeIdStr;
            }
            arrParams.push(newPledgeNum, orderInfo.relevance_id);
        }
        else if (orderInfo.pledge_way == commonUtil.PLEDGE_WAY.dueOnDemand) {
            /// 验证用户货币是否充足
            let usableBalanNum = await this.service.userService.getUserBalanceByCoinType(userId, orderInfo.symbol);
            if (usableBalanNum < 0 || usableBalanNum < addPledgeNum) {
                return {
                    success: false,
                    msg: 'Params AddpledgeNum Error',
                    code: code.ERROR_PARAMS,
                    type: 'ERROR_PARAMS',
                }
            }
            newPledgeNum = commonUtil.bigNumberPlus(orderInfo.pledge_amount, addPledgeNum, 6);
            arrParams.push(newPledgeNum);
        }
        console.log('==11111==> arrParams =', arrParams)
        if (arrParams.length <= 1) {
            return {
                success: false,
                code: code.ERROR_UPDATE_DATA,
                msg: 'AddPledge: 更新记录错误~',
                type: 'ERROR_UPDATE_DATA'
            }
        }

        /// 转换小数点位数
        pledgeRate = commonUtil.bigNumberMultipliedBy(pledgeRate, 1, 4);
        /// 计算新的质押率并验证
        let pSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol(orderInfo.symbol);
        let lSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol(orderInfo.loan_symbol);
        let newPledgeRate = this.getCurPledgeRate(newPledgeNum, pSymbolPrice, orderInfo.amount, lSymbolPrice);
        console.log('=AddPledgeRate==> newPledgeRate= ', newPledgeRate, pledgeRate)
        if (newPledgeRate != pledgeRate) {
            return {
                success: false,
                msg: 'AddPledge Pledge Rate Surpass',
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS',
            };
        }

        arrParams.push(userId, orderId);

        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {
            let ordSql = `
                UPDATE ${table.BORROW_ORDER} ${setSql} WHERE user_id = ? AND order_id = ?
            `;

            let ordResData = await conn.query(ordSql, arrParams);
            console.log('=AddPledge==> ordSql =%s, arrParams = ', ordSql, arrParams)
            if (ordResData.affectedRows == 0) {
                await conn.rollback();
                return {
                    success: false,
                    code: code.ERROR_UPDATE_DATA,
                    msg: 'AddPledge,,ERR: 更新记录错误~',
                    type: 'ERROR_UPDATE_DATA'
                };
            }
            /// 减去增加的质押货币数量
            let resSubBal = await this.ctx.changeOneBalance(userId, 'sub', addPledgeNum, orderInfo.symbol, orderId, '借贷增押货币', '扣除新增押的货币数量');
            if (!resSubBal.success) {
                await conn.rollback();
                return {
                    success: false,
                    msg: `AddPledge 扣除质押数量~~失败 ${resSubBal.msg}`,
                    code: code.ERROR_SYSTEM,
                    type: 'ERROR_SYSTEM'
                };
            }

            if (useFinValueInfo.length > 0) {
                let bUseFinSql = `
                INSERT INTO ${table.BORROW_USE_FINANCIAL_ORDER} 
                (user_id, loan_order_id, financial_id, create_way) VALUES ${useFinValueInfo}
            `;
                console.log("====> bUseFinSql = ", bUseFinSql)
                let resFinaOrd = await conn.query(bUseFinSql);
                if (resFinaOrd.affectedRows == 0) {
                    await conn.rollback();
                    return {
                        success: false,
                        msg: `AddPledge 记录使用的理财id~~失败!`,
                        code: code.ERROR_ADD_DATA,
                        type: 'ERROR_ADD_DATA'
                    }
                }
            }

            /// 创建交易纪录
            let resTrans = await this.createMultitermTransactionOrder(userId, orderId, '借贷增押', [
                { symbol: orderInfo.symbol, category: 2, money: addPledgeNum }
            ])
            if (resTrans == false) {
                await conn.rollback();
                return {
                    success: false,
                    msg: `AddPledge 创建交易记录~~失败!`,
                    code: code.ERROR_ADD_DATA,
                    type: 'ERROR_ADD_DATA'
                };
            }

            /// 记录借贷增押情况
            let resOperLog = await this.createOperationOrderLog(userId, 'addPledge', orderId, orderInfo.pledge_way, {
                params1: '' + orderInfo.symbol,             /// 增押的货币类型
                params2: '' + orderInfo.pledge_amount,      /// 增押前质押数
                params3: '' + newPledgeNum,                 /// 增押后质押数
                params4: '' + addPledgeNum,                 /// 增加的具体值
                params5: '' + newPledgeRate,                /// 增押后当前的质押率
                params6: '' + (financeIdStr != undefined ? financeIdStr : ''),                  ///
            });
            if (resOperLog == false) {
                await conn.rollback();
                return {
                    success: false,
                    msg: `AddPledge 记录借贷操作~~失败!`,
                    code: code.ERROR_ADD_DATA,
                    type: 'ERROR_ADD_DATA'
                }
            }

            await conn.commit();
            return { success: true }
        } catch (err) {
            await conn.rollback();
            this.ctx.logger.error('addPledge >>> 逻辑错误,' + err.message);
            return {
                success: false,
                code: code.ERROR_SYSTEM,
                msg: 'AddPledge Be Defeated~~!',
                type: 'ERROR_SYSTEM'
            };
        }
    }

    /// 验证借贷记录信息
    async __verifyOrderData(userId, orderId, statusNum) {
        let ordSql = `
            SELECT bo.*, ubc.avatar FROM ${table.BORROW_ORDER} bo
            LEFT JOIN ${table.TOKENSKY_USER_BALANCE_COIN} ubc ON ubc.symbol = bo.symbol 
            WHERE bo.user_id = ? AND bo.order_id = ?
        `;
        let ordList = await this.app.mysql.get(dbName).query(ordSql, [userId, orderId]);
        if (!ordList || ordList.length != 1) {
            return -1;
        }

        let orderInfo = ordList[0];

        if (!!statusNum && orderInfo.status > statusNum) {
            return -2;
        }

        /// 转换图标资源url
        orderInfo.avatar = qiniuUtil.getSignAfterUrl(orderInfo.avatar, this.app.config.qiniuConfig);

        if (orderInfo.status < commonUtil.ORDER_STATUS.repayed) {
            const conExpireTime = dateUtil.formatBirthday(orderInfo.expire_time);
            let curDate = new Date();
            let expireDate = new Date(orderInfo.expire_time);
            let curDateStr = dateUtil.formatBirthday(curDate);

            let pSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol(orderInfo.symbol);
            let lSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol(orderInfo.loan_symbol);

            /// 当前的质押率
            let curPleRate = this.getCurPledgeRate(orderInfo.pledge_amount, pSymbolPrice, orderInfo.amount, lSymbolPrice);
            console.log('===curPleRate = ', curPleRate, orderInfo.pledge_amount, orderInfo.amount, pSymbolPrice, lSymbolPrice)

            orderInfo.pledgeRate = curPleRate;


            /// 计算借贷记录的剩余天数(不足一天扣一天)
            let surplusNum = Math.floor((expireDate.getTime() - curDate.getTime()) / 86400000);
            if (surplusNum < 0) { surplusNum = 0; }
            orderInfo.surplusDay = surplusNum;

            /////////------借贷记录的状态---------//////////////
            /// 是否是还贷日
            let diffTimeNum = expireDate.getTime() - curDate.getTime();
            if (diffTimeNum > 0 && diffTimeNum <= 86400 * 1000) {
                orderInfo.status = commonUtil.ORDER_STATUS.repayDate;
            }

            let setSql = 'SET status = ?';
            let sqlValues = [orderInfo.status];
            /// 是否到最大质押率限制的强平条件
            if (curPleRate >= 0.9000) {
                orderInfo.status = commonUtil.ORDER_STATUS.maxrate_forceding;
                setSql = setSql + ', forced_pledge_rate = ?, forceding_time = ?';
                sqlValues.push(curPleRate, curDateStr);
            }
            else if (expireDate.getTime() < Date.now()) {
                /// 是否到逾期的强平条件
                orderInfo.status = commonUtil.ORDER_STATUS.timeout_forceding;
                setSql = setSql + ', forceding_time = ?';
                sqlValues.push(curDateStr);
            }

            /// 达到需要保存借贷记录的状态
            if (orderInfo.status >= commonUtil.ORDER_STATUS.timeout_forceding) {
                let ordSql = `
                   UPDATE ${table.BORROW_ORDER} ${setSql} WHERE user_id = ? AND order_id = ?
               `;
                sqlValues.push(userId, orderId);
                let resOrd = await this.app.mysql.get(dbName).query(ordSql, sqlValues);
                if (resOrd.affectedRows == 0) {
                    //return -3;
                }
            }
        }

        return orderInfo;
    }

    /**
     * 用户某种货币类型的理财包数据
     * @param {*} userId 
     * @param {*} symbolStr 质押货币类型
     * @param {*} loanSymbolStr 借贷货币类型
     */
    async getFinanceBySymbolList(userId, symbolStr, loanSymbolStr) {
        loanSymbolStr = loanSymbolStr != undefined ? loanSymbolStr : 'USDT';
        /// 获取该货币类型的理财包数据
        let finanSql = `
            SELECT fo.id, fo.symbol, fo.order_id, fo.quantity_left, fo.maturity_time, fo.cycle, ubc.avatar 
            FROM ${table.FINANCIAL_ORDER} fo 
            LEFT JOIN ${table.TOKENSKY_USER_BALANCE_COIN} ubc ON ubc.symbol = fo.symbol 
            WHERE fo.user_id = ? AND fo.symbol = ? AND fo.maturity_time > ? AND fo.cycle >= 30 AND fo.status = 1
        `;
        /// 查找正在质押的理财包id
        let finanIdStr = await this.service.userService.getUserBorrowFinanceIds(userId, symbolStr, 1);
        if (!!finanIdStr) {
            finanSql += ` AND fo.id NOT IN(${finanIdStr})`;
        }

        finanSql += " ORDER BY maturity_time DESC";

        let expireTime = Date.now() + (30 * 86400 * 1000); /// 默认为30天时间差
        let finanList = await this.app.mysql.get(dbName).query(finanSql, [userId, symbolStr, expireTime]);
        //console.log('==getFinanceList==> finanList =', symbolStr, finanSql, expireTime, finanList)
        let finaObjList = [];
        if (!!finanList && finanList.length > 0) {

            let cfgSql = `
                SELECT 
                    MAX(pledge_rate_max) AS pledgeRateMax 
                FROM ${table.BORROW_CONF} WHERE coin_type = ? AND is_putaway = 1;
            `;
            let rateMaxNum = 0.7000;
            let cfgData = await this.app.mysql.get(dbName).query(cfgSql, [symbolStr]);
            if (!!cfgData || cfgData[0] != undefined) {
                rateMaxNum = +cfgData[0].pledgeRateMax || 0.7000;
            }

            let curSecNum = Date.now();
            for (let f = 0; f < finanList.length; f++) {
                let finaInfo = finanList[f];
                if (finaInfo == undefined) { continue; }

                /// 计算理财包的剩余天数(不足一天扣一天)
                let surplusDay = Math.floor((finaInfo.maturity_time - curSecNum) / 86400000);
                let amountNum = await this.service.homeService.getCoinUsableBorrowMaxAmount(userId, symbolStr, loanSymbolStr, finaInfo.quantity_left);

                finaInfo.avatar = qiniuUtil.getSignAfterUrl(finaInfo.avatar, this.app.config.qiniuConfig);

                finaObjList.push({
                    id: finaInfo.id,
                    icon: finaInfo.avatar,
                    orderId: finaInfo.order_id,
                    symbol: finaInfo.symbol,
                    cycleNum: Math.floor(finaInfo.cycle / 30),
                    pledgeRateMax: rateMaxNum,
                    amountNum: finaInfo.quantity_left,
                    pledgeAmount: amountNum,
                    surplusDay: surplusDay,
                })
            }
        }
        return finaObjList;
    }

    /**
     * 创建借贷记录的操作log
     * @param {*} userId 
     * @param {*} operation 操作方式
     * @param {*} orderIdStr 借贷记录id
     * @param {*} pledgeWay 质押方式
     * @param {*} params 相关参数内容
     */
    async createOperationOrderLog(userId, operation, orderIdStr, pledgeWay, params) {
        if (!userId || !operation || !orderIdStr || !pledgeWay || !params) {
            return false;
        }
        /// 记录借贷增押情况
        params = {
            ...params,
            order_id: orderIdStr,
            user_id: userId,
            pledge_way: pledgeWay,
            operation: operation,     /// 操作方式,
            create_time: dateUtil.currentDate(),
        }

        let insData = await this.app.mysql.get(dbName).insert(table.BORROW_ORDER_LOG, params);
        if (insData.affectedRows == 0) {
            return false;
        }
        return true;
    }

    /**
     * 同时创建多条货币交易记录
     * @param {*} userId 
     * @param {*} orderIdStr 
     * @param {*} paramList 参数内容数组 [{symbol:'',category:0,money:0},..]
     */
    async createMultitermTransactionOrder(userId, orderIdStr, tranType, paramList) {
        if (userId == undefined || orderIdStr == undefined ||
            tranType == undefined || paramList == undefined) {
            return false;
        }

        let tranSql = `
            INSERT INTO ${table.TOKENSKY_TRANSACTION_RECORD} 
            (user_id,coin_type,tran_type,push_time,category,money,status,relevance_category,relevance_id)  VALUES 
        `;
        let valueInfo = '';
        let curDate = dateUtil.currentDate();
        for (let p = 0; p < paramList.length; p++) {
            let obj = paramList[p];
            valueInfo += "(" + userId + ',' + JSON.stringify(obj.symbol) + "," + JSON.stringify(tranType) + "," + JSON.stringify(curDate) + "," + obj.category + "," + obj.money + ",1,\'borrowOrder\'," + orderIdStr + ")";
            if (p < paramList.length - 1) {
                valueInfo += ",";
            }
        }
        if (valueInfo < 1) {
            return false;
        }
        tranSql = tranSql + valueInfo;
        console.log('=MultitermTranOrder===> tranSql =', tranSql)

        let resFinaOrd = await this.app.mysql.get(dbName).query(tranSql);
        if (resFinaOrd.affectedRows == 0) {
            return false;
        }

        return true;
    }
}
module.exports = OrderService;
