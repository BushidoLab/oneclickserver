require('dotenv').config();
var express = require('express');
var planRouter = express.Router();
const bcrypt = require("bcrypt");
const passport = require('passport');

const mongoose = require('mongoose');

const User = mongoose.model('User');
const Product = mongoose.model('Product');
const Plan = mongoose.model('Plan');

// const Charge = require('../models/charge');
const stripe = require("stripe")(process.env.STRIPE_TEST_KEY);

const {
  ensureLoggedIn,
  ensureLoggedOut
} = require('connect-ensure-login');

planRouter.get('/create', ensureLoggedIn('/login'), async (req, res, next) => {
  try {
    let productData = await Product.find({
      _user: req.user
    });
    let planData = await Plan.find({
      _user: req.user
    });
    console.log(productData, planData);
    res.render('plans/create', {
      'products': productData,
      'plans': planData
    });
  } catch (error) {
    console.log(error);
    res.render('error')
  }
});


planRouter.post('/create', ensureLoggedIn('/login'),function(req, res, next) {
  // console.log(req.body.product)
  (async () => {
    let product = await Product.findOne({
      "_id": req.body.product
    });
    if (req.user) {
      const stripePlan = await stripe.plans.create({
        product: product.stripeProduct.id,
        nickname: 'Masternode hosting service',
        currency: 'usd',
        interval: 'month',
        amount: 10000,
      });
      const newPlan = new Plan({
        description: req.body.description,
        stripePlan: stripePlan,
        product: product
      });
      newPlan._user = req.user;
      newPlan.save();
      res.redirect('/plans/create');
    }
  })();
});


module.exports = planRouter;
