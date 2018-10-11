var express = require('express');
var coinsRouter = express.Router();
const mongoose = require('mongoose');

const Coin = mongoose.model('Coin');
const Plan = mongoose.model('Plan');

const {
  ensureLoggedIn,
  ensureLoggedOut
} = require('connect-ensure-login');

coinsRouter.get('/create', ensureLoggedIn('/login'),async (req, res, next) => {
  try {
    let planData = await Plan.find({
      _user: req.user
    });
    res.render('coins/create', {
      'plans': planData
    })
  } catch (error) {
    console.log(error);
    res.render('error')
  }
});

coinsRouter.post('/create', ensureLoggedIn('/login'), function(req, res, next) {
  (async () => {
    if (req.user) {
      const plan = await Plan.findOne({
        "_id": req.body.plan
      });
      const coinName = req.body.coinName;
      const coinTicker = req.body.coinTicker;
      const newCoin = new Coin({
        coinName: coinName,
        coinTicker: coinTicker,
        plan: plan
      })
      newCoin._user = req.user;
      newCoin.save();
      res.redirect('/coins')
    }
  })();
});

coinsRouter.get('/', ensureLoggedIn('/login'),async (req, res, next) => {
  try {
    let data = await Coin.find({_user: req.user});
    res.render('coins/index', {
      "coins": data
    });
  } catch (error) {
    console.log(error);
    res.render('error')
  }
});


module.exports = coinsRouter;
