const _ = require('lodash');
const code = require("../utils/code");
const dateUtil = require("../utils/dateUtil");
const I18nConst = require("../../config/constant/i18n");
module.exports = options => {
    //验证token是否失效
    return async function isAuthenticated(ctx, next) {

        // 检测token是否失效
        try {
            let tokenVisable = await ctx.checkTokenVisiable();
            if (!tokenVisable) {
                return ctx.body = {
                    code: code.ERROR_TOKEN_OVERDUE,
                    type: "ERROR_TOKEN_OVERDUE",
                    msg: ctx.I18nMsg(I18nConst.TokenFailed)
                }
            }
            let json = await ctx.checkToken();
            let uid;
            if (json !== false) {
                uid = json.uid;
            }
            const userInfo = await ctx.service.userService.getUserByUid(uid);
            let authorization = ctx.header.token.split(' ');
            if (_.isEmpty(userInfo)) {
                return ctx.body = {
                    code: code.ERROR_USER_NOTFOUND,
                    type: "ERROR_USER_NOTFOUND",
                    msg: ctx.I18nMsg(I18nConst.UserDoesNotExist)
                };
            } else if (userInfo.token == "") {
                return ctx.body = {
                    code: code.ERROR_TOKEN_OVERDUE,
                    type: "ERROR_TOKEN_OVERDUE",
                    msg: ctx.I18nMsg(I18nConst.TokenFailed)
                }
            } else if (userInfo.token != authorization[0]) {//表示传过来的token不是原来的token
                return ctx.body = {
                    code: code.ERROR_TOKEN_OVERDUE,
                    type: "ERROR_TOKEN_OVERDUE",
                    msg: ctx.I18nMsg(I18nConst.TokenFailed)
                }
            }

            let roleBlack = await ctx.service.userService.findOneRoleBlack(1, userInfo.phone);
            if (roleBlack && new Date(roleBlack.end_time).getTime() > new Date().getTime()) {
                return ctx.body = {
                    code: code.ERROR_USER_BLACK,
                    type: "ERROR_USER_BLACK",
                    msg: `${ctx.I18nMsg(I18nConst.OTCForbidden)} ${dateUtil.format(roleBlack.end_time)}`
                }
            }

            //是否完成身份认证
            // let realAuth = await ctx.service.userService.__verifyRealAuth(uid);
            // if (!realAuth.success) {
            //     return ctx.body = {
            //         code: realAuth.code,
            //         type: realAuth.type,
            //         msg: ctx.I18nMsg(realAuth.msg)
            //     }
            // }

            await next();
        } catch (e) {
            ctx.logger.error(`isAuthenticated error:${e.message}`);
            return ctx.body = {
                code: code.ERROR_SYSTEM,
                type: "ERROR_SYSTEM",
                msg: ctx.I18nMsg(I18nConst.SystemError)
            }
        }
    };
};
