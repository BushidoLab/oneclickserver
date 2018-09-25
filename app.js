require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser')
var logger = require('morgan');
var mongoose = require("mongoose");

const bcrypt = require("bcrypt");
const passport       = require('passport');
const LocalStrategy  = require('passport-local').Strategy;
const session        = require("express-session");

var app = express();

// Import any mongodb models
const User = require("./models/user");

// Route configuration
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var coinsRouter = require('./routes/coins');
var billingRouter = require('./routes/billing');

// MongoDB setup
mongoose.connect(process.env.MONGODB_URI).then(
  () => { /** ready to use. The `mongoose.connect()` promise resolves to undefined. */ },
  err => {
    console.log(err); /** handle initial connection error */
  }
);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname, 'public')));

//session config
app.use(session({ 
  secret: "puma wolf",
  resave: true,
  saveUninitialized: true 
}));

// Access POST params
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());


// Routes configuration
app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/', coinsRouter);
app.use('/', billingRouter);
// app.use('/', auth-routes);
app.use('/users', usersRouter);
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
  passReqToCallback : true,
  usernameField: 'email'
}, 
function (req, email, password, next) {
  User.findOne({
    email: email
  }, function (err, user) {
      console.log(err)
      if (err) {
        console.log("There was an error")
        return next(err);
      }
      if (!user) {
        console.log("User does not exist")
        return next(null, false, {
          message: 'Incorrect email'
        });
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
