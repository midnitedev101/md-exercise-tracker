const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const assert = require('assert')


app.set('json spaces', 2)

const cors = require('cors')

const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId

mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' , {
  // useMongoClient: true,
});
var Schema = mongoose.Schema;
var user = new Schema({
  // id : { type: String, required: true },
  name : { type: String, required: true },
  exercises : [{
    description : { type: String },
    duration : { type: Number },
    date : { type: Date }
  }]
});
var User = mongoose.model('User', user);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', function(req, res) {
  
  var userName = req.body.username;
  User.findOne({ name: userName }, function(err, data) {
    if (err) return err;
    
    if (data)                                                                  // User already exists
      res.json({error: data + ' already exists! Try again.'});
    else {                                                                     // New user to be added
      var new_User = User({ name: userName }); 
      new_User.save(function (s_err, s_data) {
        if (err) return err;
        console.log(s_data._id);
        res.json({name: userName, _id: s_data.id});
        // res.send('User ' + s_data.name + ' has been added to the collection.');
      });
    }
  });
});

app.post('/api/exercise/add', function(req, res) {
  
  var userId = req.body.userId;
  var desc = req.body.description;
  var dur = req.body.duration; 
  var date = req.body.date ? new Date(req.body.date) : new Date();
  
  User.findOneAndUpdate({ _id: userId }, { $push: {exercises: { $each: [{description: desc, duration: dur, date: date}] } } }, { new: true }, function (u_err, u_raw) {
    if (u_err) res.send(u_err);
    
    res.json({name: u_raw.name, _id: u_raw.id, current_exercise: {description: desc, duration: dur, date: date}}); 
  });
});

app.get('/api/exercise/users', function(req, res) {
  User.find({}).select('-duration -exercises -__v').exec( function(err, data) {
    if (err) res.send(err)
    res.send(data);
  });
});

  
app.get('/api/exercise/log', function(req, res) {
  var from = req.query.from ? new Date(req.query.from) : new Date(0);
  var to = req.query.to ? new Date(req.query.to) : new Date();
  // var limit = req.query.limit ? parseInt(req.query.limit) : 99;
  var limit = parseInt(req.query.limit)
  // console.log(limit);
  // console.log(to);
  // console.log(from);
  // console.log(typeof req.query.userId);
  
  var optionsForAggregate = [{ $match: { '_id': {$in: [ObjectId(req.query.userId)]} }, }, { $unwind: '$exercises' }, { $sort: { 'exercises.date': -1 } },];
  if (!isNaN(limit)) optionsForAggregate.push({$limit: limit});
  if (to !== 'Invalid Date') optionsForAggregate.push({ $match : { 'exercises.date' : { $lt: to} } });
  if (from !== 'Invalid Date') optionsForAggregate.push({ $match : { 'exercises.date' : { $gt: from} } });
  
  // User.aggregate([
  //   { $match: { '_id': {$in: [ObjectId(req.query.userId)]} }, },
  //   { $unwind: '$exercises' },
  //   { $sort: { 'exercises.date': -1 } },
  //   { $match : { 'exercises.date' : { $lt: to} } },
  //   { $match : { 'exercises.date' : { $gt: from} } },
  // ], function (s_err, s_data) {
  //   if (s_err) res.send(s_err)
  //     res.send(s_data)
  // });
  
  User.aggregate(
    optionsForAggregate, function(s_err, s_data) {
      if (s_err) res.send(s_err)
      // res.send(s_data);
      // res.send(s_data[0])
      res.send({name: s_data[0].name, id: s_data[0]._id, count: s_data.length,  exercises: s_data.map((e) => { 
        return e.exercises;
      })});
  });
  
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
