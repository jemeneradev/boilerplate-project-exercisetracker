require('dotenv').config();
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const moment = require("moment")

const cors = require('cors')

const mongoose = require('mongoose')

var db = mongoose.createConnection(process.env.MONGODB, {
  useMongoClient: true
})

db.then(function(db) {
  /* Use `db`, for instance `db.model()`*/
  var Schema = mongoose.Schema;

var userSchema = new Schema({
  username:  {
    type: String,
    required: true,
    unique:true
  }
});

var User = db.model('User', userSchema);

const convertToDate = (formatted) =>{
  let extract_date = formatted.split("-")
  let dateToSave = new Date(parseInt(extract_date[0]),parseInt(extract_date[1])-1,parseInt(extract_date[2]))
  return dateToSave;
}
const twodigit=(num)=>{
  return (num>9) ? num : `0${num}`
}
const checkdate = (submitted_date)=>{
      if(/\d{4}[-]\d{2}[-]\d{2}/gi.test(submitted_date)===false){//if empty or if date is given wrong
        let d = new Date() 
        return d;
      }
      else {
        return convertToDate(submitted_date); 
      }
}

const formatDate = (submitteddate=null) => {
  if (submitteddate===null) {  
   let parts = new Date(Date.now()).toString().split(' ') 
   return `${parts[0]} ${parts[1]} ${twodigit(parts[2])} ${parts[3]}`
  }
  else {
    let date = moment(submitteddate).format("llll").replace(/,/g,'').split(' ');
    date[2] = twodigit(parseInt(date[2]))
    return date.slice(0,4).join(" ")
  }
}

var exerciseSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  description: {
    type: String,
    maxlength:250,
    validate: {
      validator:function(v) {
        return /^\s+$/gi.test(v)===false;
      }
    }
  },
  duration: {
    type: Number,
    min: 1,
    get: v => Math.round(v),
    set: v => Math.round(v),
    required: true
  },
  date:{
    type: Date,
    get:(v)=>{
      return formatDate(v) 
    }
  }
})

var Exercise = db.model('Exercise', exerciseSchema)


app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


app.post('/api/exercise/new-user',(req,res)=>{
  console.log("attempting to create a user")
  if(req.body.username === undefined || req.body.username === ""){
    res.json({error:"username was not provided"})
  }
  else {
    User.create({ username: req.body.username }, function (err, newuser) {
      if (err) {
        console.log(err)
        res.json({error:"Username already exists."})
      }
      else{
        console.log("success: created a new user")
        res.json({username:newuser.username,_id:newuser._id})
      }// saved!
    });
  }
})

app.get('/api/exercise/users',(req,res)=>{
  User.find({},'username _id',function (err, docs) { 
    if(err){
      res.json({error:"no users found."})
    }
    else {
      res.json(docs)
    }
  })
});

app.post('/api/exercise/add',(req,res)=>{
  console.log(req.body)
  User.findById({_id:req.body.userId}, function (err, userfound) {
    if(err){
      res.json({error:"an error ocurred"})
    }
    else {
        Exercise.create({
          userId:req.body.userId,
          description:req.body.description,
          duration:req.body.duration,
          date: checkdate(req.body.date)},(exerciseError,exercise)=>{
          if(exerciseError){
            console.log(exerciseError)
            res.json({error:"exercise info incorrect "})
          }
          else {
            res.json({
              _id:userfound._id,
              username:userfound.username,
              description:exercise.description,
              duration:exercise.duration,
              date:exercise.date
            })
          }
        })
    }
  });
})
/*
const join_logs = (user,results) => {
  let logs = []
  for(var x in results){
    let r = results[x]
    logs.push({description:r.description,duration:r.duration,date:r.date})
  }
  return {_id:user._id,username:user.username,logs:logs,count:logs.length};
}

app.get("/api/exercise/log",(req,res)=>{
  console.log(req.query)
  if (/^[0-9A-Z]+$/gi.test(req.query.userId)) {
    User.findById(req.query.userId,'username _id',(err,user)=>{
      if(err || user ===null) res.json({error:"user could not be found"})
      if(req.query.from===undefined || /\d{4}\/\d{2}\/\d{2}/.test(req.query.from)===false){
        if(req.query.limit===undefined || /\d+/.test(req.query.limit)===false){
          Exercise.where({userId:req.query.userId}).exec((err,results)=>{
            console.log("from was not provided")
            res.json(join_logs(user,results));
          })
        }
        Exercise.where({userId:req.query.userId}).limit(parseInt(req.query.limit)).exec((err,results)=>{
          console.log("from was not provided")
          res.json(join_logs(user,results));
        })
        
      }
      else {
        let to = (req.query.to===undefined || /\d{4}\/\d{2}\/\d{2}/.test(req.query.to)===false) ? Date.now() : convertToDate(req.query.to);
        if(req.query.limit===undefined || /\d+/.test(req.query.limit)===false){
          Exercise.where({userId:req.query.userId}).where({date:{$gte: convertToDate(req.query.from), $lte: to}})
          .exec((err,results)=>{
            console.log("from was provided");
            res.json(join_logs(user,results));
          })
        }
        Exercise.where({userId:req.query.userId}).where({date:{$gte: convertToDate(req.query.from), $lte: to}}).limit(parseInt(req.query.limit))
        .exec((err,results)=>{
          console.log("from was provided");
          res.json(join_logs(user,results));
        })
        
        
      }

    })
  }
  else {
    res.json({error:"please provide valid userId"})
  }
})
*/

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

});

db.catch((err)=>{
  console.log("connection error: "+ err);
  process.exit(1);
})
