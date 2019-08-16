'use strict';

const Controller = require('egg').Controller;
const Response = require('../utils/resObj');
const code = require('../utils/code');
const commonUtil = require("../utils/commonUtil");
const I18nConst = require('../../config/constant/i18n');

class BorrowController extends Controller {

    /// 进入我要借贷界面获取数据
    async getBorrowPageData() {
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
            let pledgeWay = body.pledge_way || 1;   /// 默认是活期账户方式 (1 活期; 2 理财)
            let relevanceId = body.relevance_id;    /// 为理财方式时，可传多个理财包id，以 , 字符区分

            console.log('======> getBorrowPageData Start userId = ', userId, body);
            let resData = await this.ctx.service.borrowService.getPledgeCoinAllInfo(userId, symbolStr, pledgeWay, relevanceId);
            if (!resData || resData == undefined) {
                this.ctx.logger.error('getBorrowPageData error: resData == undefined');
                response.errMsg(ctx.I18nMsg(I18nConst.ERROR_DATA), code.ERROR_DATA, 'ERROR_DATA');
                return this.ctx.body = response;
            }
            //console.log('===0000111112222==> resData =', resData);
            response.content = resData;
            return this.ctx.body = response;
        } catch (e) {
            this.ctx.logger.error('getBorrowPageData > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }

    /// 确定借贷
    async ensureBorrow() {

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
            console.log('====ensureBorrow====> body = ', body)
            /// 验证是否登录和密码是否设置以及交易密码
            let verifyResult = await this.service.userService.__verifyTransactionPassword(userId, body);
            if (!verifyResult.success) {
                response.errMsg(verifyResult.msg, verifyResult.code, verifyResult.type);
                return this.ctx.body = response;
            }

            /// 质押货币类型
            let symbolStr = body.symbol;
            let loanSymbolStr = body.loan_symbol || 'USDT';
            let pledgeRate = body.pledge_rate;
            let cycleMonth = body.cycle_month;
            let borrowAmount = body.borrow_amonut;
            let pledgeWay = body.pledge_way;
            let relevanceId = body.relevance_id;    /// 可传多个理财包id，以 , 字符区分

            let resData = await this.ctx.service.borrowService.createBorrowOrder(userId, symbolStr, loanSymbolStr, pledgeWay, relevanceId, pledgeRate, cycleMonth, borrowAmount);
            console.log('==ensureBorrow==> resData =', resData);
            if (!resData.success) {
                response.errMsg(resData.msg, resData.code, resData.type);
                return this.ctx.body = response;
            }

            response.content = {
                order_id: resData.orderId
            }
            return this.ctx.body = response;

        } catch (e) {
            this.ctx.logger.error('ensureBorrow > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }

}

module.exports = BorrowController;
