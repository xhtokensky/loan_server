var Response = function () {
    this.msg = "ok";
    this.type = 'SUCCESS';
    this.code = 0;
    this.content = {};
    this.errMsg = function (msg, resultCode, resultType) {
        this.msg = msg;
        this.code = 9999;
        if (resultCode) {
            this.code = resultCode;
        }
        if (resultType) {
            this.type = resultType
        }
    };
    this.success = function (msg) {
        if (msg) {
            this.msg = msg;
        }
    }
};
module.exports = function (options) {
    return new Response(options);
};
