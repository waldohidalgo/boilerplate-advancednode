'use strict';
require('dotenv').config();
const express = require('express');
const myDB = require('./connection');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const session =require("express-session");
const routes = require('./routes.js');
const auth=require("./auth.js");
const app = express();
const MongoStore = require('connect-mongo')(session);
const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });

const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cookieParser=require("cookie-parser");
const passportSocketIo=require("passport.socketio");

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  key: 'express.sid',
  cookie: { secure: false },
  store: store
}));

function onAuthorizeSuccess(data, accept) {
  console.log('successful connection to socket.io');
  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept) {
  if (error) throw new Error(message);
  console.log('failed connection to socket.io:', message);
  accept(null, false);
}
io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: 'express.sid',
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
  })
);


fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'pug');
app.set("views","./views/pug");



const PORT = process.env.PORT || 3000;

let currentUsers = 0;

http.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});



myDB(async client => {
  
  const myDataBase = await client.db('test').collection('users');
  auth(app, myDataBase);
  routes(app, myDataBase);

  

  io.on('connection', socket => {
    console.log('A user has connected');
    console.log('user ' + socket.request.user.username + ' connected');
    ++currentUsers;
    io.emit('user', {username: socket.request.user.username,currentUsers,connected:true});
    socket.on('disconnect', () => {
      /*anything you want to do on disconnect*/
      console.log('user disconnected');
      --currentUsers;
      io.emit('user', {username: socket.request.user.username,currentUsers,connected:false});
    });

    socket.on("chat message",message=>{
      io.emit("chat message",{username:socket.request.user.username,message})
    })
  });
  
  // Be sure to add this...
}).catch(e => {
  
  app.route('/').get((req, res) => {
    res.render('index', { title: e, message: 'Unable to connect to database' });
  });
});



