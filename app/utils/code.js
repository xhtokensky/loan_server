module.exports = {
    SUCCESS: 0,
    ERROR_SYSTEM: 9999,
    ERROR_PARAMS: 1001,
    ERROR_GET_DATA: 1002,
    ERROR_ADD_DATA: 1003,
    ERROR_TOKEN_OVERDUE: 1006,
    ERROR_USER_NOTFOUND: 1007,
    ERROR_ACCOUNT_PASSWORD: 1008,
    ERROR_USER_BLACK: 1009,
    ERROR_USER_LOGGING: 1010,
    ERROR_DATA: 1011,
    ERROR_UPDATE_DATA: 1014,
    ERROR_VALIDATE_OVERTIEM: 1028,
    ERROR_JIGUANG_EXCEPTION: 1029,
    ERROR_VALID_CODE: 1030,
    ERROR_VALID_PIC_CODE: 1033,
    ERROR_CHECK_NOTFOUND: 1055,
    ERROR_NICKNAME_LONG: 1057,
    ERROR_SET_PWD: 1058,//未设置交易密码
    ERROR_TPWD_ERR: 1059,//验证交易密码不正确
    ERROR_REAL_AUTH_OK: 1060,//实名认证审核通过
    ERROR_REAL_AUTH_YET: 1061,//已经实名认证过了
    ERROR_REAL_AUTH_UNCENSORED: 1062,//实名认证未审核
    ERROR_REAL_AUTH_NO: 1063,//实名认证审核未通过
    ERROR_REAL_AUTH_UN: 1064,//未实名认证

    ERROR_ORDER_NOT_EXIST: 1100,//记录不存在
    ERROR_ORDER_STATUS_ERR: 1101,// 记录状态错误
    ERROR_ORDER_TIME_OUT: 1102,// 记录已过期
}
