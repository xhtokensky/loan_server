'use strict';

const Controller = require('egg').Controller;
const Response = require('../utils/resObj');
const code = require('../utils/code');
const commonUtil = require('../utils/commonUtil');
const I18nConst = require('../../config/constant/i18n');

class HomeController extends Controller {

    async getBorrowHomeData() {
        const { ctx } = this;
        let response = Response();
        try {
            // let json = await this.ctx.checkToken();
            // if (!json) {
            //     response.errMsg(this.ctx.I18nMsg(I18nConst.TokenFailed), code.ERROR_TOKEN_OVERDUE, 'ERROR_TOKEN_OVERDUE');
            //     return this.ctx.body = response;
            // }
             let userId = 1006//json.uid;
            let body = this.ctx.request.body;
            let loanSymbolStr = body.loan_symbol || 'USDT';

            let bCfgList = await this.ctx.service.homeService.getCoinBorrowConfigList(userId);
            //console.log('======bCfgList = ', bCfgList);
            /// 已借贷的金额
            let borrowedNum = await this.ctx.service.homeService.getOrderTotalAmountByStatus(userId, commonUtil.ORDER_STATUS.overdue);

            let resList = await this.ctx.service.homeService.getUserAllUsableBalanceAndBorrowAmount(userId, loanSymbolStr);
            /// 不区分质押货币类型的所有可借贷金额
            let totalAmountNum = 0;
            for (let r = 0; r < resList.length; r++) {
                let uBalanInfo = resList[r];
                totalAmountNum = commonUtil.bigNumberPlus(totalAmountNum, uBalanInfo.amount, 6);
            }

            /// 区分货币类型的理财包的可借贷金额
            for (let b = 0; b < bCfgList.length; b++) {
                let resBalanNum = await this.service.userService.getFinanceAllBalanceByIds(userId, bCfgList[b].coinType);
                console.log("===> Finance BalanNum = ", resBalanNum, bCfgList[b].coinType)
                if (resBalanNum > 0) {
                    let amountNum = await this.service.homeService.getCoinUsableBorrowMaxAmount(userId, bCfgList[b].coinType, loanSymbolStr, resBalanNum);
                    if (amountNum > 0) {
                        bCfgList[b].pledgeAmount = commonUtil.bigNumberPlus(bCfgList[b].pledgeAmount, amountNum, 6);
                        totalAmountNum = commonUtil.bigNumberPlus(totalAmountNum, amountNum, 6);
                    }
                }

            }

            /// 减去已借贷的金额
            //totalAmountNum = commonUtil.bigNumberMinus(totalAmountNum, borrowedNum, 6);
            response.content.totalBorrowNum = totalAmountNum;
            response.content.borrowedNum = borrowedNum;
            response.content.borrowCfgList = bCfgList;

            return this.ctx.body = response;
        } catch (e) {
            this.ctx.logger.error('getBorrowHomeData > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }
}

module.exports = HomeController;
