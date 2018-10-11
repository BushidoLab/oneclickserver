const express = require('express');
const httpStatus = require('http-status');
const coinsRouter = require('./coins');
const billingRouter = require('./billing');
const planRouter = require('./plan');
const productRouter = require('./product');
const mainRouter = require('./main');
const mongoose = require('mongoose');

const shell = require('shelljs');
const router = express.Router();

const {
  ensureLoggedIn,
  ensureLoggedOut
} = require('connect-ensure-login');

const Coin = mongoose.model('Coin');
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');

const stripe = require("stripe")(process.env.STRIPE_TEST_KEY);

router.get('/status', (req, res) => res.json({
  success: true,
  message: 'OK',
  status: httpStatus.OK
}));

/**
 * GET /coins
 */
router.use('/coins', coinsRouter);

/**
 * GET /billing
 */
router.use('/billing', billingRouter);

/**
 * GET /plan
 */
router.use('/plans', planRouter);

/**
 * GET /product
 */
router.use('/products', productRouter);

/**
 * GET /product
 */
router.use('/', mainRouter);


module.exports = router;
