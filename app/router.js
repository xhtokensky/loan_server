'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {

    const isAuthenticated = app.middleware.isAuthenticated();

    const { router, controller } = app;

    /// 借贷首页
    router.get('/borrow/getBorrowHomeData', controller.home.getBorrowHomeData);

    /// 我要借贷界面
    router.post('/borrow/getBorrowPageData', isAuthenticated, controller.borrow.getBorrowPageData);
    router.post('/borrow/ensureBorrow', isAuthenticated, controller.borrow.ensureBorrow);

    /// 理财界面数据
    router.post('/borrow/getFinancePageData', isAuthenticated, controller.order.getFinancePageData);
    /// 用户活期账户界面
    router.post('/borrow/getBalancePageData', isAuthenticated, controller.order.getBalancePageData);
    /// 我的借贷
    router.post('/borrow/getOrderList', isAuthenticated, controller.order.getOrderListData);
    /// 借贷记录详情
    router.post('/borrow/getOrderDetails', isAuthenticated, controller.order.getOrderDetails);

    /// 还贷界面
    router.post('/borrow/getRepayBorrowPage', isAuthenticated, controller.order.getRepayBorrowPageData);
    /// 确定还贷
    router.post('/borrow/repayBorrow', isAuthenticated, controller.order.repayBorrow);

    /// 增加质押货币的数量
    router.post('/borrow/addPledgeAmount', isAuthenticated, controller.order.addPledgeAmount);
    /// 获取增加质押货币界面数据
    //router.post('/borrow/getAddPledgePageData', isAuthenticated, controller.order.getAddPledgePageData);
};
