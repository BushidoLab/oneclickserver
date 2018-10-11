require('dotenv').config();
var express = require('express');
var productRouter = express.Router();
const bcrypt = require("bcrypt");
const passport = require('passport');

const mongoose = require('mongoose');

const User = mongoose.model('User');
const Product = mongoose.model('Product');

const stripe = require("stripe")(process.env.STRIPE_TEST_KEY);

const {
  ensureLoggedIn,
  ensureLoggedOut
} = require('connect-ensure-login');

productRouter.get('/create', ensureLoggedIn('/login'), async (req, res, next) => {
  try {
    let productData = await Product.find({_user:req.user});
    res.render('products/create', {
      'products': productData,
    });
  } catch (error) {
    console.log(error);
    res.render('error')
  }
});

productRouter.post('/create', ensureLoggedIn('/login'),function(req, res, next) {
  (async function() {
    if(req.user){
      const product = await stripe.products.create({
        name: 'My SaaS Platform 3',
        type: 'service',
      });
      const newProduct = new Product({
        description: req.body.description,
        stripeProduct: product
      });
      newProduct._user = req.user;
      newProduct.save();
      res.redirect('/products/create');
    }
  })();
});



module.exports = productRouter;
