var express = require('express');
var router = express.Router();
const bcrypt = require("bcrypt");
const passport = require('passport');
var nodemailer = require("nodemailer");
const crypto = require('crypto');
const mongoose = require('mongoose');
const stripe = require("stripe")(process.env.STRIPE_TEST_KEY);

const User = mongoose.model('User');
const Masternode = mongoose.model('Masternode');
const Coin = mongoose.model('Coin');
const Plan = mongoose.model('Plan');

const {
  ensureLoggedIn,
  ensureLoggedOut
} = require('connect-ensure-login');

/* GET home page. */
router.get('/', ensureLoggedIn('/login'), function(req, res, next) {
  let _user = req.user;
  // console.log(req.user);
  Masternode.find({
    "_owner": _user,
  }, function(err, data) {
    console.log(data);
    if (err) {
      console.log("There's been an error");
      res.render('error');
    } else {
      _masternodes = data;
      res.render('index', {
        title: 'Express',
        "masternodes": _masternodes,
        success: false,
        error: false
      })
    }
  })
});

router.get('/masternodes', ensureLoggedIn('/login'), function(req, res, next) {
  Masternode.find({}, function(err, data) {
    if (err) {
      res.render('error')
    } else {
      console.log(data[0].masternodeprivkey)
      res.render('masternodes', {
        "masternodes": data
      });
    }
  });
});


router.get('/success', function(req, res, next) {
  res.render('success', {
    title: 'SUCCESS'
  });
})

router.post('/deploy/masternode', ensureLoggedIn('/login'),function(req, res, next) {
  // TODO: Dynamically generate masternodeprivkey for user
  try {
    const masternodeprivkey = req.body.masternodeprivkey;
    const owner = req.user;
    (async () => {
      const masterNode = await Masternode.find({
        "_owner": owner,
      });

      const coin = await Coin.findOne({
        'coinTicker': "ANON",
        _user: owner
      });

      console.log(masterNode);


      if(masterNode.length){
          if(coin) {
            const masterNodesExist = await Masternode.find({
              "_owner": owner,
              _coin : coin._id
            });
            if(masterNodesExist.length) {
              res.render('index', {
                title: 'Express',
                "masternodes": masterNode,
                success: false,
                error: "You already have a subscription with this coin : ANON"
              });
            } else {
              console.log('not supported multiple coin subscription');
            }
          } else {
            res.render('index', {
              title: 'Express',
              "masternodes": masterNode,
              success: false,
              error: "No coin found with ticker ANON"
            });
          }
      } else {
        console.log('no data masterNode');
        if(!owner.stripeCustomer){
          console.log('no customer');
          res.render('index', {
            title: 'Express',
            "masternodes": masterNode,
            success: false,
            error: "Customer doesn't have any card. Click on billing to add new."
          });
        } else {
          if(!coin){
            res.render('index', {
              title: 'Express',
              "masternodes": masterNode,
              success: false,
              error: "No coin found with ticker ANON"
            });
          } else {
            const plan = await Plan.findOne({
              '_id': coin.plan
            })

            // console.log(plan.stripePlan.id)
            const stripeSubscription = await stripe.subscriptions.create({
              customer: owner.stripeCustomer.id,
              items: [{
                plan: plan.stripePlan.id
              }]
            })
            console.log('stripeSubscription');

            const stripeInvoices = await stripe.invoices.list({
              limit: 5 ,
              customer: owner.stripeCustomer.id,
              subscription: stripeSubscription.id
            });

            // const stripeUpcomingInvoices = await stripe.invoices.retrieveUpcoming({
            //   customer: owner.stripeCustomer.id,
            //   subscription: stripeSubscription.id
            // });

            console.log('Invoice'+ stripeInvoices);
            // console.log('Upcoming Invoices'+ stripeUpcomingInvoices);


            const newMasternode = new Masternode({
              masternodeprivkey: masternodeprivkey,
              _owner: owner,
              _coin: coin,
              stripeSubscription: stripeSubscription,
              stripeInvoices: stripeInvoices,
              // stripeUpcomingInvoices: stripeUpcomingInvoices
            })

            newMasternode.save();
            res.redirect('/');
          }
        }
      }
    })();
  } catch (error) {
    console.log(error);
    res.render('error')
  }
});

router.post('/deploy', ensureLoggedIn('/login'), function(req, res, next) {
  // console.log(req.body);
  let masternodeprivkey = req.body.masternodeprivkey;
  shell.exec("sh ./public/scripts/create.sh " + masternodeprivkey, {
    async: true
  })
  res.redirect('/success')
  // shell.exec("sh ./public/scripts/create.sh " + txHash, function(code, stdout, stderr) {
  //   console.log('Exit code:', code);
  //   console.log('Program output:', stdout);
  //   console.log('Program stderr:', stderr);
  // });
})

// Get Login page
router.get('/login', ensureLoggedOut('/'), function(req, res, next) {
  res.render('auth/login');
});

// Post Log-In request
router.post('/login', ensureLoggedOut(), passport.authenticate('local-login', {
  // authRoutes.post('/login', ensureLoggedOut(), passport.authenticate('local-login', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

// Log-out
router.get('/logout', ensureLoggedIn('/login'), function(req, res) {
  req.logout();
  res.redirect('login');
});

// Get Signup page
router.get('/signup', function(req, res, next) {
  res.render('auth/signup');
});

// User Sign-up
router.post('/signup', (req, res, next) => {
  // router.post('/signup', ensureLoggedIn('/login'), requireRole('admin'), (req, res, next) => {
  console.log(req.body.email);
  const email = req.body.email.toString();
  const password = req.body.password.toString();

  //Check if user provided email and password
  if (email === "" || password === "") {
    console.log("Indicate username and password");
    res.render("error", {
      error: "Indicate username and password"
    });
    return;
  }
  //Check if the user already exist in the database (based on email address)
  User.findOne({
    "email": email
  }, async (err, user) => {
    if (err) {
      console.log(err);
    }
    if (user !== null) {
      console.log("The username already exists")
      res.render("auth/signup", {
        msg: {
          "error": "The username already exists"
        }
      });
      return;
    }
    //Generate and store hashed password
    let hashedPassword = generateHashedPassword(password);
    // TODO: Add user activation token
    let randomToken = await crypto.randomBytes(20).toString('hex');
    //Create new user object
    const newUser = new User({
      email: email,
      password: hashedPassword,
      accountActivationToken: randomToken.toString()
    });

    console.log("new user:");
    console.log(newUser);

    //Save new user to MongoDB
    try {
      await newUser.save();

      var smtpTransport = nodemailer.createTransport({
        // service: process.env.EMAIL_SERVICE,
        host: process.env.HOST,
        port: process.env.SMTP_PORT,
        // secure: process.env.SECURE,
        secure: false,
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAILPW
        }
      });

      var mailOptions = {
        // to: email,
        to: process.env.EMAIL,
        from: process.env.EMAIL,
        subject: 'OneClickMasternodes: Account Registration',
        // html: emailTemplateSignup(email, newUser.accountActivationToken, process.env.REQ_URL),
        html: emailTemplateSignup(process.env.EMAIL, newUser.accountActivationToken, process.env.REQ_URL),
        //req.headers.host
        attachments: [{
          filename: 'anon.png',
          path: process.cwd() + '/public/images/anon.png',
          cid: 'anon@logo' //same cid value as in the html img src
        }]
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        if (err) {
          console.log("node mailer error:", err);
          return;
        }
      });

    } catch (err) {
      console.log(err);
      res.render("error", {
        error: "Something went wrong"
      });
    }
    res.redirect('/');
  });
});

// Account/User activation
router.get('/confirm/:token', function(req, res) {
  (async () => {
    const _user = await User.findOne({
      accountActivationToken: req.params.token
    });
    if (_user.isAccountActivated = true) {
      // TODO: flash/alert error to user "your account has already been activated"
      res.redirect('/login')
    } else {
      _user.isAccountActivated = true
      _user.save();
    }
  })();
  res.redirect('/');
});

// Render forgot password view
router.get('/forgot_password', (req, res, next) => {
  res.render('auth/forgotPassword');
});

router.post('/forgot_password', (req, res, next) => {
  (async () => {
    const _user = await User.findOne({
      email: req.body.email
    });
    console.log
    if (!_user) {
      console.log("User does not exist");
      res.render("/forgot_password", {
        msg: {
          "error": "The username already exists"
        }
      });
      return;
    } else {
      //generate random token
      const _token = crypto.randomBytes(20).toString('hex');
      _user.resetPasswordToken = _token;
      _user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      _user.save();
      dispatchMail(_user, 'passwordReset');
    }
  })();
  res.redirect('/login')
});

router.get('/password_reset/:token', (req, res) => {
  (async () => {
    const _user = await User.findOne({
      resetPasswordToken: req.params.token
    });
    console.log(_user)
  })();
  res.render('auth/passwordReset', {
    title: 'Express',
    passwordResetoken: req.params.token
  });
});

router.post('/password_reset/:token', (req, res, next) => {
  (async () => {
    const _user = await User.findOne({
      resetPasswordToken: req.params.token
    });
    let hashedPassword = generateHashedPassword(req.body.newPassword);
    _user.password = hashedPassword;
    _user.save();
  })();
  res.redirect('/login');
});

function dispatchMail(recipient, type) {
  (async () => {
    console.log(recipient);
    console.log(recipient.resetPasswordToken.toString())
    let smtpTransport = nodemailer.createTransport({
      // service: process.env.EMAIL_SERVICE,
      host: process.env.HOST,
      port: process.env.SMTP_PORT,
      // secure: process.env.SECURE,
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAILPW
      }
    });
    if (type == 'passwordReset') {
      let mailOptions = {
        // to: email,
        to: process.env.EMAIL,
        from: process.env.EMAIL,
        subject: 'OneClickMasternodes: Password Reset/Recovery',
        html: passwordResetTemplate(process.env.EMAIL, recipient.resetPasswordToken, process.env.REQ_URL),
        attachments: [{
          filename: 'anon.png',
          path: process.cwd() + '/public/images/anon.png',
          cid: 'anon@logo' //same cid value as in the html img src
        }]
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        if (err) {
          console.log("node mailer error:", err);
          return;
        }
      });
    }
    // TODO: add more case statements

  })();
}


//GENERATE HASHED PASSWORD
function generateHashedPassword(password) {
  let hashPass;
  const bcryptSalt = 10;
  const salt = bcrypt.genSaltSync(bcryptSalt);
  hashPass = bcrypt.hashSync(password, salt);
  return hashPass;
}

function emailTemplateSignup(email, token, host) {
  let newEmail = `<!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
        <meta charset="utf-8"> <!-- utf-8 works for most cases -->
        <meta name="viewport" content="width=device-width"> <!-- Forcing initial-scale shouldn't be necessary -->
        <meta http-equiv="X-UA-Compatible" content="IE=edge"> <!-- Use the latest (edge) version of IE rendering engine -->
        <meta name="x-apple-disable-message-reformatting">  <!-- Disable auto-scale in iOS 10 Mail entirely -->
        <title></title> <!-- The title tag shows in email notifications, like Android 4.4. -->

        <!-- Web Font / @font-face : BEGIN -->
        <!-- NOTE: If web fonts are not required, lines 10 - 27 can be safely removed. -->

        <!-- Desktop Outlook chokes on web font references and defaults to Times New Roman, so we force a safe fallback font. -->
        <!--[if mso]>
            <style>
                * {
                    font-family: sans-serif !important;
                }
            </style>
        <![endif]-->

        <!-- All other clients get the webfont reference; some will render the font and others will silently fail to the fallbacks. More on that here: http://stylecampaign.com/blog/2015/02/webfont-support-in-email/ -->
        <!--[if !mso]><!-->
        <!-- insert web font reference, eg: <link href='https://fonts.googleapis.com/css?family=Roboto:400,700' rel='stylesheet' type='text/css'> -->
        <!--<![endif]-->

        <!-- Web Font / @font-face : END -->

        <!-- CSS Reset : BEGIN -->
        <style>
            /* What it does: Remove spaces around the email design added by some email clients. */
            /* Beware: It can remove the padding / margin and add a background color to the compose a reply window. */
            html,
            body {
                margin: 0 auto !important;
                padding: 0 !important;
                height: 100% !important;
                width: 100% !important;
            }
            /* What it does: Stops email clients resizing small text. */
            * {
                -ms-text-size-adjust: 100%;
                -webkit-text-size-adjust: 100%;
            }
            /* What it does: Centers email on Android 4.4 */
            div[style*="margin: 16px 0"] {
                margin: 0 !important;
            }
            /* What it does: Stops Outlook from adding extra spacing to tables. */
            table,
            td {
                mso-table-lspace: 0pt !important;
                mso-table-rspace: 0pt !important;
            }
            /* What it does: Fixes webkit padding issue. Fix for Yahoo mail table alignment bug. Applies table-layout to the first 2 tables then removes for anything nested deeper. */
            table {
                border-spacing: 0 !important;
                border-collapse: collapse !important;
                table-layout: fixed !important;
                margin: 0 auto !important;
            }
            table table table {
                table-layout: auto;
            }
            /* What it does: Uses a better rendering method when resizing images in IE. */
            img {
                -ms-interpolation-mode:bicubic;
            }
            /* What it does: A work-around for email clients meddling in triggered links. */
            *[x-apple-data-detectors],  /* iOS */
            .unstyle-auto-detected-links *,
            .aBn {
                border-bottom: 0 !important;
                cursor: default !important;
                color: inherit !important;
                text-decoration: none !important;
                font-size: inherit !important;
                font-family: inherit !important;
                font-weight: inherit !important;
                line-height: inherit !important;
            }
            /* What it does: Prevents Gmail from displaying a download button on large, non-linked images. */
            .a6S {
                display: none !important;
                opacity: 0.01 !important;
            }
            /* If the above doesn't work, add a .g-img class to any image in question. */
            img.g-img + div {
                display: none !important;
            }
            /* What it does: Prevents underlining the button text in Windows 10 */
            .button-link {
                text-decoration: none !important;
            }
            /* What it does: Removes right gutter in Gmail iOS app: https://github.com/TedGoas/Cerberus/issues/89  */
            /* Create one of these media queries for each additional viewport size you'd like to fix */
            /* iPhone 4, 4S, 5, 5S, 5C, and 5SE */
            @media only screen and (min-device-width: 320px) and (max-device-width: 374px) {
                .email-container {
                    min-width: 320px !important;
                }
            }
            /* iPhone 6, 6S, 7, 8, and X */
            @media only screen and (min-device-width: 375px) and (max-device-width: 413px) {
                .email-container {
                    min-width: 375px !important;
                }
            }
            /* iPhone 6+, 7+, and 8+ */
            @media only screen and (min-device-width: 414px) {
                .email-container {
                    min-width: 414px !important;
                }
            }
        </style>
        <!-- CSS Reset : END -->
        <!-- Reset list spacing because Outlook ignores much of our inline CSS. -->
        <!--[if mso]>
        <style type="text/css">
            ul,
            ol {
                margin: 0 !important;
            }
            li {
                margin-left: 30px !important;
            }
            li.list-item-first {
                margin-top: 0 !important;
            }
            li.list-item-last {
                margin-bottom: 10px !important;
            }
        </style>
        <![endif]-->

        <!-- Progressive Enhancements : BEGIN -->
        <style>
            /* What it does: Hover styles for buttons */
            .button-td,
            .button-a {
                transition: all 100ms ease-in;
            }
            .button-td-primary:hover,
            .button-a-primary:hover {
                background: #000000 !important;
                border-color: #000000 !important;
            }
            /* Media Queries */
            @media screen and (max-width: 600px) {
                /* What it does: Adjust typography on small screens to improve readability */
                .email-container p {
                    font-size: 17px !important;
                }
            }
        </style>
        <!-- Progressive Enhancements : END -->

        <!-- What it does: Makes background images in 72ppi Outlook render at correct size. -->
        <!--[if gte mso 9]>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
        <![endif]-->

    </head>
    <!--
        The email background color (#222222) is defined in three places:
        1. body tag: for most email clients
        2. center tag: for Gmail and Inbox mobile apps and web versions of Gmail, GSuite, Inbox, Yahoo, AOL, Libero, Comcast, freenet, Mail.ru, Orange.fr
        3. mso conditional: For Windows 10 Mail
    -->
    <body width="100%" style="margin: 0; mso-line-height-rule: exactly; background-color: #f5f7fa;">
        <center style="width: 100%; background-color: #f5f7fa; text-align: left;">
        <!--[if mso | IE]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #222222;">
        <tr>
        <td>
        <![endif]-->

            <!-- Visually Hidden Preheader Text : BEGIN -->
            <!-- Visually Hidden Preheader Text : END -->

            <!-- Create white space after the desired preview text so email clients don’t pull other distracting text into the inbox preview. Extend as necessary. -->
            <!-- Preview Text Spacing Hack : BEGIN -->

            <!-- Preview Text Spacing Hack : END -->

            <!--
                Set the email width. Defined in two places:
                1. max-width for all clients except Desktop Windows Outlook, allowing the email to squish on narrow but never go wider than 600px.
                2. MSO tags for Desktop Windows Outlook enforce a 600px width.
            -->
            <div style="max-width: 600px; margin: auto;" class="email-container">
                <!--[if mso]>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center">
                <tr>
                <td>
                <![endif]-->

                <!-- Email Header : BEGIN -->

                <!-- Email Header : END -->

                <!-- Email Body : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px;">

                    <!-- Hero Image, Flush : BEGIN -->
                    <tr>
                        <td align="center" style="background-color: #ffffff;">
                            <img src="cid:anon@logo" width="250" height="250" alt="alt_text" border="0" align="center" style="width: 100%; max-width: 250px; height: auto; background: #dddddd; font-family: sans-serif; font-size: 15px; line-height: 140%; color: #555555; margin: auto;" class="g-img">
                        </td>
                    </tr>
                    <!-- Hero Image, Flush : END -->

                    <!-- 1 Column Text + Button : BEGIN -->
                    <tr>
                        <td style="background-color: #ffffff;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding: 40px; font-family: sans-serif; font-size: 15px; line-height: 140%; color: #555555;">
                                        <h1 style="margin: 0 0 10px 0; font-family: sans-serif; font-size: 24px; line-height: 125%; color: #333333; font-weight: normal;">Welcome!</h1>
                                        <h3 style="margin: 0 0 10px 0; font-family: sans-serif; font-size: 24px; line-height: 125%; color: #333333; font-weight: normal;">${email}</h3>
                                        <p style="margin: 0;">We're excited to have you get started. First, you need to confirm your account. Just press the button below.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 0 40px; font-family: sans-serif; font-size: 15px; line-height: 140%; color: #000000">
                                        <!-- Button : BEGIN -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: auto;">
                                            <tr>
                                                <td class="button-td button-td-primary" style="border-radius: 4px; background: #555555;">
                                                    <a class="button-a button-a-primary" href="http://${host}/confirm/${token}" style="background: #47192E; border: 1px solid #000000; font-family: sans-serif; font-size: 15px; line-height: 15px; text-decoration: none; padding: 13px 17px; display: block; border-radius: 4px;"><span class="button-link" style="color:#ffffff">Active your account</span></a>
                                                </td>
                                            </tr>
                                        </table>
                                        <!-- Button : END -->
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px 40px 0px 40px; font-family: sans-serif; font-size: 15px; line-height: 140%; color: #555555;">
                                        <p style="margin: 0;">If that doesn't work, copy and paste the following link in your browser:</p>
                                        <br>
                                        <p style="margin: 0;">http://${host}/confirm/${token}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- 1 Column Text + Button : END -->

                    <!-- 1 Column Text : BEGIN -->
                    <tr>
                        <td style="background-color: #ffffff;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 20px 40px 40px 40px;  font-family: sans-serif; font-size: 15px; line-height: 140%; color: #555555;">
                                        <p style="margin: 0;">If you have any questions, just reply to this email - we're always happy to help out.</p>
                                        <br>
                                        <p style="margin: 0;">Cheers,</p>
                                        <p style="margin: 0;">The OneClickMasternodes Team</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- 1 Column Text : END -->

                </table>
                <!-- Email Body : END -->

                <!-- Email Footer : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px;">
                    <tr>
                        <td style="padding: 40px 10px; font-family: sans-serif; font-size: 12px; line-height: 140%; text-align: center; color: #888888;">
                        OneClickMasternodes<br><span class="unstyle-auto-detected-links">mail: info@OneClickMasternode.io, Location: Eastern U.S.A</span>
                        </td>
                    </tr>
                </table>
                <!-- Email Footer : END -->

                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </div>
            <!-- Full Bleed Background Section : END -->

        <!--[if mso | IE]>
        </td>
        </tr>
        </table>
        <![endif]-->
        </center>
    </body>
    </html>`

  return newEmail;
}

function passwordResetTemplate(email, token, host) {
  let newEmail = `<!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
        <meta charset="utf-8"> <!-- utf-8 works for most cases -->
        <meta name="viewport" content="width=device-width"> <!-- Forcing initial-scale shouldn't be necessary -->
        <meta http-equiv="X-UA-Compatible" content="IE=edge"> <!-- Use the latest (edge) version of IE rendering engine -->
        <meta name="x-apple-disable-message-reformatting">  <!-- Disable auto-scale in iOS 10 Mail entirely -->
        <title></title> <!-- The title tag shows in email notifications, like Android 4.4. -->

        <!-- Web Font / @font-face : BEGIN -->
        <!-- NOTE: If web fonts are not required, lines 10 - 27 can be safely removed. -->

        <!-- Desktop Outlook chokes on web font references and defaults to Times New Roman, so we force a safe fallback font. -->
        <!--[if mso]>
            <style>
                * {
                    font-family: sans-serif !important;
                }
            </style>
        <![endif]-->

        <!-- All other clients get the webfont reference; some will render the font and others will silently fail to the fallbacks. More on that here: http://stylecampaign.com/blog/2015/02/webfont-support-in-email/ -->
        <!--[if !mso]><!-->
        <!-- insert web font reference, eg: <link href='https://fonts.googleapis.com/css?family=Roboto:400,700' rel='stylesheet' type='text/css'> -->
        <!--<![endif]-->

        <!-- Web Font / @font-face : END -->

        <!-- CSS Reset : BEGIN -->
        <style>
            /* What it does: Remove spaces around the email design added by some email clients. */
            /* Beware: It can remove the padding / margin and add a background color to the compose a reply window. */
            html,
            body {
                margin: 0 auto !important;
                padding: 0 !important;
                height: 100% !important;
                width: 100% !important;
            }
            /* What it does: Stops email clients resizing small text. */
            * {
                -ms-text-size-adjust: 100%;
                -webkit-text-size-adjust: 100%;
            }
            /* What it does: Centers email on Android 4.4 */
            div[style*="margin: 16px 0"] {
                margin: 0 !important;
            }
            /* What it does: Stops Outlook from adding extra spacing to tables. */
            table,
            td {
                mso-table-lspace: 0pt !important;
                mso-table-rspace: 0pt !important;
            }
            /* What it does: Fixes webkit padding issue. Fix for Yahoo mail table alignment bug. Applies table-layout to the first 2 tables then removes for anything nested deeper. */
            table {
                border-spacing: 0 !important;
                border-collapse: collapse !important;
                table-layout: fixed !important;
                margin: 0 auto !important;
            }
            table table table {
                table-layout: auto;
            }
            /* What it does: Uses a better rendering method when resizing images in IE. */
            img {
                -ms-interpolation-mode:bicubic;
            }
            /* What it does: A work-around for email clients meddling in triggered links. */
            *[x-apple-data-detectors],  /* iOS */
            .unstyle-auto-detected-links *,
            .aBn {
                border-bottom: 0 !important;
                cursor: default !important;
                color: inherit !important;
                text-decoration: none !important;
                font-size: inherit !important;
                font-family: inherit !important;
                font-weight: inherit !important;
                line-height: inherit !important;
            }
            /* What it does: Prevents Gmail from displaying a download button on large, non-linked images. */
            .a6S {
                display: none !important;
                opacity: 0.01 !important;
            }
            /* If the above doesn't work, add a .g-img class to any image in question. */
            img.g-img + div {
                display: none !important;
            }
            /* What it does: Prevents underlining the button text in Windows 10 */
            .button-link {
                text-decoration: none !important;
            }
            /* What it does: Removes right gutter in Gmail iOS app: https://github.com/TedGoas/Cerberus/issues/89  */
            /* Create one of these media queries for each additional viewport size you'd like to fix */
            /* iPhone 4, 4S, 5, 5S, 5C, and 5SE */
            @media only screen and (min-device-width: 320px) and (max-device-width: 374px) {
                .email-container {
                    min-width: 320px !important;
                }
            }
            /* iPhone 6, 6S, 7, 8, and X */
            @media only screen and (min-device-width: 375px) and (max-device-width: 413px) {
                .email-container {
                    min-width: 375px !important;
                }
            }
            /* iPhone 6+, 7+, and 8+ */
            @media only screen and (min-device-width: 414px) {
                .email-container {
                    min-width: 414px !important;
                }
            }
        </style>
        <!-- CSS Reset : END -->
        <!-- Reset list spacing because Outlook ignores much of our inline CSS. -->
        <!--[if mso]>
        <style type="text/css">
            ul,
            ol {
                margin: 0 !important;
            }
            li {
                margin-left: 30px !important;
            }
            li.list-item-first {
                margin-top: 0 !important;
            }
            li.list-item-last {
                margin-bottom: 10px !important;
            }
        </style>
        <![endif]-->

        <!-- Progressive Enhancements : BEGIN -->
        <style>
            /* What it does: Hover styles for buttons */
            .button-td,
            .button-a {
                transition: all 100ms ease-in;
            }
            .button-td-primary:hover,
            .button-a-primary:hover {
                background: #000000 !important;
                border-color: #000000 !important;
            }
            /* Media Queries */
            @media screen and (max-width: 600px) {
                /* What it does: Adjust typography on small screens to improve readability */
                .email-container p {
                    font-size: 17px !important;
                }
            }
        </style>
        <!-- Progressive Enhancements : END -->

        <!-- What it does: Makes background images in 72ppi Outlook render at correct size. -->
        <!--[if gte mso 9]>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
        <![endif]-->

    </head>
    <!--
        The email background color (#222222) is defined in three places:
        1. body tag: for most email clients
        2. center tag: for Gmail and Inbox mobile apps and web versions of Gmail, GSuite, Inbox, Yahoo, AOL, Libero, Comcast, freenet, Mail.ru, Orange.fr
        3. mso conditional: For Windows 10 Mail
    -->
    <body width="100%" style="margin: 0; mso-line-height-rule: exactly; background-color: #f5f7fa;">
        <center style="width: 100%; background-color: #f5f7fa; text-align: left;">
        <!--[if mso | IE]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #222222;">
        <tr>
        <td>
        <![endif]-->

            <!-- Visually Hidden Preheader Text : BEGIN -->
            <!-- Visually Hidden Preheader Text : END -->

            <!-- Create white space after the desired preview text so email clients don’t pull other distracting text into the inbox preview. Extend as necessary. -->
            <!-- Preview Text Spacing Hack : BEGIN -->

            <!-- Preview Text Spacing Hack : END -->

            <!--
                Set the email width. Defined in two places:
                1. max-width for all clients except Desktop Windows Outlook, allowing the email to squish on narrow but never go wider than 600px.
                2. MSO tags for Desktop Windows Outlook enforce a 600px width.
            -->
            <div style="max-width: 600px; margin: auto;" class="email-container">
                <!--[if mso]>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center">
                <tr>
                <td>
                <![endif]-->

                <!-- Email Header : BEGIN -->

                <!-- Email Header : END -->

                <!-- Email Body : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px;">

                    <!-- Hero Image, Flush : BEGIN -->
                    <tr>
                        <td align="center" style="background-color: #ffffff;">
                            <img src="cid:anon@logo" width="250" height="250" alt="alt_text" border="0" align="center" style="width: 100%; max-width: 250px; height: auto; background: #dddddd; font-family: sans-serif; font-size: 15px; line-height: 140%; color: #555555; margin: auto;" class="g-img">
                        </td>
                    </tr>
                    <!-- Hero Image, Flush : END -->

                    <!-- 1 Column Text + Button : BEGIN -->
                    <tr>
                        <td style="background-color: #ffffff;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding: 40px; font-family: sans-serif; font-size: 15px; line-height: 140%; color: #555555;">
                                        <h1 style="margin: 0 0 10px 0; font-family: sans-serif; font-size: 24px; line-height: 125%; color: #333333; font-weight: normal;">Hello!</h1>
                                        <h2 style="margin: 0 0 10px 0; font-family: sans-serif; font-size: 24px; line-height: 125%; color: #333333; font-weight: normal;">${email}</h2>
                                        <p style="margin: 0;">You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                                        <p style="margin: 0;">To reset your password please click on the following link.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 0 40px; font-family: sans-serif; font-size: 15px; line-height: 140%; color: #000000">
                                        <!-- Button : BEGIN -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: auto;">
                                            <tr>
                                                <td class="button-td button-td-primary" style="border-radius: 4px; background: #555555;">
                                                    <a class="button-a button-a-primary" href="http://${host}/password_reset/${token}" style="background: #47192E; border: 1px solid #000000; font-family: sans-serif; font-size: 15px; line-height: 15px; text-decoration: none; padding: 13px 17px; display: block; border-radius: 4px;"><span class="button-link" style="color:#ffffff">Reset Password</span></a>
                                                </td>
                                            </tr>
                                        </table>
                                        <!-- Button : END -->
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px 40px 0px 40px; font-family: sans-serif; font-size: 15px; line-height: 140%; color: #555555;">
                                        <p style="margin: 0;">If that doesn't work, copy and paste the following link in your browser:</p>
                                        <br>
                                        <p style="margin: 0;">http://${host}/password_reset/${token}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- 1 Column Text + Button : END -->

                    <!-- 1 Column Text : BEGIN -->
                    <tr>
                        <td style="background-color: #ffffff;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 20px 40px 40px 40px;  font-family: sans-serif; font-size: 15px; line-height: 140%; color: #555555;">
                                        <br>
                                        <p style="margin: 0;">Cheers,</p>
                                        <p style="margin: 0;">The OneClickMasternodes Team</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- 1 Column Text : END -->

                </table>
                <!-- Email Body : END -->

                <!-- Email Footer : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px;">
                    <tr>
                        <td style="padding: 40px 10px; font-family: sans-serif; font-size: 12px; line-height: 140%; text-align: center; color: #888888;">
                        OneClickMasternodes<br><span class="unstyle-auto-detected-links">mail: info@oneclickmasternodes.io, Location: Eastern U.S.A</span>
                        </td>
                    </tr>
                </table>
                <!-- Email Footer : END -->

                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </div>
            <!-- Full Bleed Background Section : END -->

        <!--[if mso | IE]>
        </td>
        </tr>
        </table>
        <![endif]-->
        </center>
    </body>
    </html>`

  return newEmail;
}


module.exports = router;
