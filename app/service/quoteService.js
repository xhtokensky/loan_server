'use strict';

const Service = require('egg').Service;


class quoteService extends Service {


    async findOneQuoteUSDBySymbol(symbol) {
        let {ctx} = this;
        let obj = await ctx.model.Quote.findOne({symbol: symbol});
        if (!obj) {
            return 0;
        }
        if (!obj.quote) {
            return 0;
        }
        if (!obj.quote.USD) {
            return 0;
        }
        if (!obj.quote.USD.price) {
            return 0;
        }
        return obj.quote.USD.price;
    }

}

module.exports = quoteService;
