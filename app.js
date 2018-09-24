require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser')
var logger = require('morgan');
var mongoose = require("mongoose");

const passport       = require('passport');
const LocalStrategy  = require('passport-local').Strategy;
const session        = require("express-session");

var app = express();


// Route configuration
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var coinsRouter = require('./routes/coins');

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

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Routes configuration
app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/', coinsRouter);
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

// Authenticate user via passport
passport.use('local-login', new LocalStrategy({
  passReqToCallback : true,
  usernameField: 'email'
}, 
function (req, email, password, next) {
    User.findOne({
      email: email
    }, function (err, user) {
      if (err) {
        //req.flash('error', 'Something went wrong');
        return next(err);
      }
      if (!user) {
        //req.flash('error', 'Incorrect email');
        return next(null, false, {
          message: 'Incorrect email'
        });
      }
      if (!bcrypt.compareSync(password, user.password)) {
        //req.flash('error', 'Incorrect password');
        return next(null, false, {
          message: "Incorrect password"
        });
      }
      return next(null, user);
    });
  }
));


module.exports = app;
