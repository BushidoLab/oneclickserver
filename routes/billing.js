require('dotenv').config();
var express = require('express');
var billingRouter = express.Router();
const bcrypt = require("bcrypt");
const passport = require('passport');
const mongoose = require('mongoose');

const Charge = mongoose.model('Charge');
const User = mongoose.model('User');
const Masternode = mongoose.model('Masternode');
const stripe = require("stripe")(process.env.STRIPE_TEST_KEY);
const _ = require('lodash');

const {
  ensureLoggedIn,
  ensureLoggedOut
} = require('connect-ensure-login');


billingRouter.get('/', ensureLoggedIn('/login'), async (req, res, next) => {
  try {
    let _user = req.user;
    let invoices = await Masternode.findOne({
      "_owner": _user,
    },{'stripeInvoices':1});

    // let data = await Charge.find({
    //   _owner: _user
    // });

    console.log(invoices.stripeInvoices);

    res.render('billing/index', {
      title: "New Billing",
      error: false,
      success: false,
      // "bills": data,
      "cards": _user.stripeCustomer ? _user.stripeCustomer.sources.data : [],
      "bills": invoices.stripeInvoices ? invoices.stripeInvoices.data : false,
    });

  } catch (error) {
    console.log(error);
    res.render('billing/index', {
      error: error,
      success: false,
      "cards": req.user.stripeCustomer ? req.user.stripeCustomer.sources.data : [],
      "bills": [],
    });
  }
});

billingRouter.post('/update', ensureLoggedIn('/login'), async (req, res, next) => {
  try {
    let _user = req.user;

    if(_user){
      // let bills = await Charge.find({
      //   _owner: _user
      // });

      let invoices = await Masternode.findOne({
        "_owner": _user,
      },{'stripeInvoices':1});

      console.log(_user.stripeCustomer);
      // Create a Customer with Stripe:
      console.log("The Stripe Token = " + req.body.stripeToken);
      if(!_user.stripeCustomer) {
        const customer = await stripe.customers.create({
          source: req.body.stripeToken,
          email: _user.email,
        });

        // Associate Stripe Customer with mongodb user
        _user.stripeToken = req.body.stripeToken;
        _user.stripeCustomer = customer;
        //  Save and update User record
        _user.save();

        res.render('billing/index', {
          success: "Card added successfully",
          error: false,
          // "bills": bills,
          "cards": _user.stripeCustomer ? _user.stripeCustomer.sources.data : [],
          "bills": invoices.stripeInvoices ? invoices.stripeInvoices.data : false,
        });

      } else {
        console.log('customer already exist :', _user.stripeCustomer);

        let card_data = await stripe.tokens.retrieve(req.body.stripeToken);

        let card_token = _user.stripeCustomer.sources.data.length ? await _.find(_user.stripeCustomer.sources.data, function (o) {
            console.log(o.fingerprint , card_data.card.fingerprint);
            if (o.fingerprint == card_data.card.fingerprint) {
                return o;
            }
        }) : false;

        console.log('card token =>', card_token);

        if(!card_token) {
          console.log(_user.stripeCustomer.id);
          let create_card = await stripe.customers.createSource(_user.stripeCustomer.id, { source: req.body.stripeToken });

          // old card removed
          const delete_card = await stripe.customers.deleteCard(_user.stripeCustomer.id, _user.stripeCustomer.sources.data[0].id);

          _user.stripeCustomer.sources.data[0] = create_card;
          _user.stripeCustomer.default_source = create_card.id;
          _user.save();

          res.render('billing/index', {
            success: "Card added successfully",
            error: false,
            // "bills": bills,
            "cards": _user.stripeCustomer ? _user.stripeCustomer.sources.data : [],
            "bills": invoices.stripeInvoices ? invoices.stripeInvoices.data : false,
          });

        } else {
          console.log('same card found');
          res.render('billing/index', {
            success: false,
            error: "Same card can not be added twice",
            // "bills": bills,
            "cards": req.user.stripeCustomer ? req.user.stripeCustomer.sources.data : [],
            "bills": invoices.stripeInvoices ? invoices.stripeInvoices.data : false,
          });
        }
      }
    }
  } catch (error) {
    console.log(error);
    res.render('billing/index', {
      error: error,
      success: false,
      "cards": req.user.stripeCustomer ? req.user.stripeCustomer.sources.data : [],
      bills: []
    });
  }
});

billingRouter.post('/charges/create', ensureLoggedIn(), function(req, res, next) {

  let _amount = 999;
  let _user = req.user;
  console.log('The customer ID = ' + _user.stripeCustomer.id);

  (async function() {
    // Charge the Customer instead of the card:
    // const charge = await stripe.charges.create({
    //       amount: _amount,
    //       currency: 'usd',
    //       customer: _user.stripeCustomer.id,
    //     });

    // console.log(charge)

    // Store Charge record in mongodb as new record;
    const newCharge = new Charge({
      _owner: _user,
      _stripeCharge: charge,
    });
    // Save record
    newCharge.save();

  })();
  res.redirect('/billing')

});









// _user.save(function(err, result){
//     if(err){
//         console.log("There was an error");
//     } else {
//         console.log("Save was a success")

//         // Set your secret key: remember to change this to your live secret key in production
//         // See your keys here: https://dashboard.stripe.com/account/apikeys

//         // Don't use for now, this is for charging the customers card
//         // const _charge = stripe.charges.create({
//         // amount: _amount,
//         // currency: 'usd',
//         // description: 'Monthly charge for masternode hosting',
//         // source: _user.stripeToken,
//         // })

//         // Don't use for now, this is for creating charge records in the local app mongodb later on
//         // .then((err, res) => {
//         //     if(err) {
//         //         console.log("abort")
//         //     } else{
//         //         const newCharge = new Charge({
//         //             _owner: _user,
//         //             _stripeCharge: _charge,
//         //             amount: _amount
//         //         })
//         //         newCharge.save(function(err, result){
//         //             if(err){
//         //                 console.log("There was an error");
//         //                 res.redirect('/billing')
//         //             } else {
//         //                 console.log("Successfull");
//         //                 res.redirect('/success');
//         //             }
//         //         })
//         //     }
//         // })
//     }
// });





module.exports = billingRouter;
