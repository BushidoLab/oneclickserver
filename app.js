require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser')
const logger = require('morgan');
const mongoose = require("mongoose");

const bcrypt = require("bcrypt");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require("express-session");
const fs = require('fs');

const models = path.join(__dirname, './models');
fs.readdirSync(models)
  .filter(file => ~file.search(/^[^\.].*\.js$/))
  .forEach(file => require(path.join(models, file)));

var app = express();

// Import any mongodb models
const User = require("./models/user");

// Route configuration
var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');
// var authRouter = require('./routes/auth');
// var coinsRouter = require('./routes/coins');
// var billingRouter = require('./routes/billing');
// var productRouter = require('./routes/product');
// var planRouter = require('./routes/plan');

// MongoDB setup
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useCreateIndex: true,
}).then(
  () => { /** ready to use. The `mongoose.connect()` promise resolves to undefined. */
    console.log("Connected to DataBase " + process.env.MONGODB_URI);
  }, err => {
    console.log(err); /** handle initial connection error */
  }
);



// app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname, 'public')));

//session config
app.use(session({
  secret: "puma wolf",
  resave: true,
  saveUninitialized: true
}));
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Access POST params
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
  extended: false
}));
app.use(cookieParser());


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes configuration
app.use('/', indexRouter);
// app.use('/', authRouter);
// app.use('/', coinsRouter);
// app.use('/', billingRouter);
// app.use('/', productRouter);
// app.use('/', planRouter);
// app.use('/', auth-routes);
// app.use('/users', usersRouter);
// const authRoutes = require('./routes/auth-routes');

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// //passport config
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Authenticate user via passport
passport.use('local-login', new LocalStrategy({
    passReqToCallback: true,
    usernameField: 'email'
  },
  function(req, email, password, next) {
    User.findOne({
      email: email
    }, function(err, user) {
      console.log(err)
      if (err) {
        console.log("There was an error")
        return next(err);
      }
      if (!user) {
        console.log("User does not exist")
        return next(null, false, {
        // res.render("auth/login", {
          msg: {
            "error": 'You have enterred either an incorrect email or an incorrect password'
          }
        });
        // return;
        // });
      }
      if (!bcrypt.compareSync(password, user.password)) {
        return next(null, false, {
          message: "Incorrect password"
        });
      }
      return next(null, user);
    });
  }
));


module.exports = app;
