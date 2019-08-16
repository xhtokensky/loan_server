'use strict';

const Controller = require('egg').Controller;
const Response = require('../utils/resObj');
const code = require('../utils/code');
const I18nConst = require('../../config/constant/i18n');
const commonUtil = require('../utils/commonUtil');
const table = require('../../config/constant/table');


class OrderController extends Controller {

    /// 获取用户的所有借贷数据
    async getOrderListData() {
        const { ctx } = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            if (!json) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TokenFailed), code.ERROR_TOKEN_OVERDUE, 'ERROR_TOKEN_OVERDUE');
                return this.ctx.body = response;
            }
            let userId = json.uid;
            let body = this.ctx.request.body;
            let symbolStr = body.symbol;
            ///标签页的标识 1 使用中 2 还贷日 3 强平中 4 已结清(已还款和已强平)
            let lableIndex = body.lable_index || 1;

            let resData = await this.ctx.service.orderService.getUserOrderList(userId, symbolStr, lableIndex);
            console.log('======> getOrderList Start userId = ', userId, body, resData);
            if (!resData) {
                response.errMsg('getOrderList 获取订单列表失败~~', code.ERROR_GET_DATA, 'ERROR_GET_DATA');
                return this.ctx.body = response;
            }

            //console.log('===> resData = ', resData)
            response.content.orderList = resData;
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('getOrderList > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }

    /// 获取订单的详情
    async getOrderDetails() {
        const { ctx } = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            if (!json) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TokenFailed), code.ERROR_TOKEN_OVERDUE, 'ERROR_TOKEN_OVERDUE');
                return this.ctx.body = response;
            }
            let userId = json.uid;
            let body = this.ctx.request.body;
            let orderId = body.order_id;

            console.log('======> getOrderDetails Start userId = ', userId, orderId);

            let resData = await this.ctx.service.orderService.getOrderDetailsById(userId, orderId);
            if (resData.success == false) {
                response.errMsg(resData.msg, resData.code, resData.type);
                return this.ctx.body = response;
            }

            response.content = resData.resObj;
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('getOrderDetails > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }

    /// 获取还贷界面数据
    async getRepayBorrowPageData() {

        const { ctx } = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            console.log('===> json =', json)
            if (!json) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TokenFailed), code.ERROR_TOKEN_OVERDUE, 'ERROR_TOKEN_OVERDUE');
                return this.ctx.body = response;
            }
            let userId = json.uid;
            let body = this.ctx.request.body;
            let orderId = body.order_id;
            console.log('======>getRepayBorrowPageData Start userId = ', userId, orderId);

            let resData = await this.ctx.service.orderService.getRepayBorrowPageData(userId, orderId);
            if (resData.success == false) {
                response.errMsg(resData.msg, resData.code, resData.type);
                return this.ctx.body = response;
            }

            response.content = resData.resObj;
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('getRepayBorrowPageData > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }
    /// 借贷还款
    async repayBorrow() {
        const { ctx } = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            if (!json) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TokenFailed), code.ERROR_TOKEN_OVERDUE, 'ERROR_TOKEN_OVERDUE');
                return this.ctx.body = response;
            }
            let userId = json.uid;
            let body = this.ctx.request.body;
            let orderId = body.order_id;
            console.log('======> repayBorrow Start userId = ', userId, body);

            /// 验证是否登录和密码是否设置以及交易密码
            let verifyResult = await this.service.userService.__verifyTransactionPassword(userId, body);
            if (!verifyResult.success) {
                response.errMsg(verifyResult.msg, verifyResult.code, verifyResult.type);
                return this.ctx.body = response;
            }

            let resData = await this.ctx.service.orderService.repayBorrow(userId, orderId);
            if (resData.success == false) {
                response.errMsg(resData.msg, resData.code, resData.type);
                return this.ctx.body = response;
            }

            //response.content = { code: 0, msg: 'ok' };
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('repayBorrow > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }

    }

    /// 确定添加质押数额
    async addPledgeAmount() {
        const { ctx } = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            if (!json) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TokenFailed), code.ERROR_TOKEN_OVERDUE, 'ERROR_TOKEN_OVERDUE');
                return this.ctx.body = response;
            }
            let userId = json.uid;
            let body = this.ctx.request.body;
            let orderId = body.order_id;
            let addAmount = body.add_pledge_amount;
            let pledgeRate = body.pledge_rate;
            let financeIdStr = body.relevancle_id;
            console.log('======> addPledgeAmount Start userId = ', userId, body);

            /// 验证是否登录和密码是否设置以及交易密码
            let verifyResult = await this.service.userService.__verifyTransactionPassword(userId, body);
            if (!verifyResult.success) {
                response.errMsg(verifyResult.msg, verifyResult.code, verifyResult.type);
                return this.ctx.body = response;
            }

            /// 验证理财包id字符串内是否重复的id
            if (financeIdStr != undefined) {
                let resBool = commonUtil.stringIsRepetition(financeIdStr, ',', 1);

            }
            let resData = await this.ctx.service.orderService.addBorrowPledgeAmount(userId, orderId, addAmount, pledgeRate, financeIdStr);
            console.log('===addPledgeAmount==> resData =', resData)
            if (resData.success == false) {
                response.errMsg(resData.msg, resData.code, resData.type);
                return this.ctx.body = response;
            }

            //response.content = {};
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('addPledgeAmount > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }

    }

    /// 理财包界面数据
    async getFinancePageData() {
        const { ctx } = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            if (!json) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TokenFailed), code.ERROR_TOKEN_OVERDUE, 'ERROR_TOKEN_OVERDUE');
                return this.ctx.body = response;
            }
            let userId = json.uid;
            let body = this.ctx.request.body;
            let symbolStr = body.symbol;
            let orderId = body.order_id;

            console.log('==getFinancePageData==> body =', body);
            let finanList = [];
            response.content.reqType = 1;
            if (!!orderId) {

                /// 借贷记录的详情信息
                let orderInfo = await this.service.orderService.getOrderDetailsById(userId, orderId);
                if (orderInfo.success == false) {
                    response.errMsg(orderInfo.msg, orderInfo.code, orderInfo.type);
                    return this.ctx.body = response;
                }

                finanList = await this.service.orderService.getFinanceBySymbolList(userId, symbolStr);

                let pSymbolPirce = await this.service.quoteService.findOneQuoteUSDBySymbol(orderInfo.resObj.symbol);
                let lSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol(orderInfo.resObj.loanSymbol);

                response.content = {
                    ...response.content,
                    reqType: 2,                 /// 
                    symbolPrice: pSymbolPirce,  /// 质押货币美金价格
                    usdtPirce: lSymbolPrice,       /// USDT美金价格
                    pledgeAmount: orderInfo.resObj.pledgeAmount,    /// 当前记录的质押数
                    pledgeRate: orderInfo.resObj.pledgeRate,        /// 当前记录的质押率
                    borrowAmount: orderInfo.resObj.amount,          /// 当前记录的借贷货币金额
                }
            }
            else {
                finanList = await this.service.orderService.getFinanceBySymbolList(userId, symbolStr);
            }

            //console.log('====> finanList =', finanList);
            response.content.financeList = finanList;
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('getFinancePageData > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }

    /// 用户的货币余额界面数据
    async getBalancePageData() {
        const { ctx } = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            if (!json) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TokenFailed), code.ERROR_TOKEN_OVERDUE, 'ERROR_TOKEN_OVERDUE');
                return this.ctx.body = response;
            }
            let userId = json.uid;
            let body = this.ctx.request.body;
            let orderId = body.order_id || ''; ///追加质押数量的借贷记录id
            let loanSymbolStr = body.loan_symbol || 'USDT';
            console.log("====getBalancePageData===> body =", body)
            if (!!orderId) {
                /// 借贷记录的详情信息
                let orderInfo = await this.service.orderService.getOrderDetailsById(userId, orderId);
                if (orderInfo.success == false) {
                    response.errMsg(orderInfo.msg, orderInfo.code, orderInfo.type);
                    return this.ctx.body = response;
                }

                let pSymbolPirce = await this.service.quoteService.findOneQuoteUSDBySymbol(orderInfo.resObj.symbol);
                let lSymbolPrice = await this.service.quoteService.findOneQuoteUSDBySymbol(orderInfo.resObj.loanSymbol);

                /// symbol货币类型的可用余额
                let usableBalanNum = await this.service.userService.getUserBalanceByCoinType(userId, orderInfo.resObj.symbol);
                if (!!usableBalanNum && usableBalanNum < 0) { usableBalanNum = 0; }

                response.content = {
                    symbolPrice: pSymbolPirce,  /// 质押货币美金价格
                    usdtPirce: lSymbolPrice,    /// USDT美金价格
                    pledgeAmount: orderInfo.resObj.pledgeAmount,    /// 当前记录的质押数
                    pledgeRate: orderInfo.resObj.pledgeRate,        /// 当前记录的质押率
                    borrowAmount: orderInfo.resObj.amount,          /// 当前记录的借贷货币金额
                    usableBala: usableBalanNum, /// 货币可用余额
                    reqType: 2
                }

                return this.ctx.body = response;
            }
            else {
                let balanList = await this.service.homeService.getUserAllUsableBalanceAndBorrowAmount(userId, loanSymbolStr);
                response.content.reqType = 1;
                response.content.balanceList = balanList;
                return this.ctx.body = response;
            }
        } catch (e) {
            ctx.logger.error('getBalancePageData > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }
}

module.exports = OrderController;
