module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const schema = new Schema({
        id: {type: Number},
        base_category: {type: String},
        name: {type: String},
        symbol: {type: String},
        slug: {type: String},
        circulating_supply: {type: Number},
        max_supply: {type: Number},
        date_added: {type: Date},
        num_market_pairs: {type: Number},
        tags: {type: []},
        platform: {},
        cmc_rank: {type: Number},
        last_updated: {type: Date},
        quote: {type: mongoose.Schema.Types.Mixed, default: {}}
    });
    schema.index({symbol: 1,}, {unique: false});
    return mongoose.model('Quote', schema, 'quote');  //返回model
};
