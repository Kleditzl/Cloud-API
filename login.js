const express = require('express');
const router = express.Router();
const axios = require('axios');
const ds = require('./datastore');
const datastore = ds.datastore;
const {google} = require('googleapis');
var app = express();

const USER = "User";

const { engine } = require('express-handlebars');
app.engine('handlebars', engine({ extname: '.hbs', defaultLayout: "main"}));
app.set('view engine', 'handlebars'); 
const client_id= "11052066670-nmmjl2ljobdffs81q7t4er1pc0fcoc7j.apps.googleusercontent.com";
const client_secret= "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";

/******************************Begin Model Functions*********************************/
//first part is from the docs https://developers.google.com/identity/protocols/oauth2/web-server#httprest
var redirectURL = 'https://accounts.google.com/o/oauth2/v2/auth?' + 'scope=https://www.googleapis.com/auth/userinfo.profile&' + 'response_type=code&state='; //state
var redirectURL_2 = '&redirect_uri=https://final-kleditzl.uw.r.appspot.com/oauth&client_id=' + client_id;

//googled "how to get random string in JS"
//https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function state_make(length){
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
function post_user(f_name, l_name,sub){
    //console.log(volume,item,creation_date);
    var key = datastore.key(USER);
	const new_load = {"first_name": f_name, "last_name": l_name, "sub": sub};
	return datastore.save({"key":key, "data":new_load}).then(() => {return key});
}

function get_users(){
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        // Use Array.map to call the function fromDatastore. This function
        // adds id attribute to every element in the array at element 0 of
        // the variable entities
        return entities[0].map(ds.fromDatastore);
    });
}
/******************************End Model Functions*********************************/
/******************************Begin controler functions***************************/
//console.log(app);
//console.log(app.view);
  //This is to just the first page stuff, had to reopen a lot of my CS290 homework/notes from Robin Hess 
  //also this https://waelyasmina.medium.com/a-guide-into-using-handlebars-with-your-express-js-application-22b944443b65
app.get('/', function(req,res) {
    res.render('home');
});

//https://developers.google.com/identity/protocols/oauth2/web-server#httprest
//These next two get calls are basically all from the google doc's
app.get('/authorize', async function(req, res){
    var s_return = state_make(15);
    console.log(s_return);
    var temp = redirectURL + s_return + redirectURL_2;
    res.redirect(temp);
});

var resp_content = {}; //so I can save the contents of the get request and send them to be rendered in the final page!
app.get('/oauth', async function(req,res){
    var res_1 = res;//this is so I can render the last page, since the get and post don't give me an adequate response
    //www.npmjs.com/package/axios
    axios({
        method: 'POST',
        url: 'https://www.googleapis.com/oauth2/v4/token',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'accept': 'application/json',
            'Accept-Encoding':  '*'
        },
        params: {
            code: req.query.code,
            client_id: client_id,
            client_secret: client_secret,
            redirect_uri: 'https://final-kleditzl.uw.r.appspot.com/oauth',
            grant_type: 'authorization_code'
        } 
    }).then(function(req,res){
        var token = req.data.id_token;
        var a_token = req.data.access_token;
        var base64Url = token.split('.')[1];
        var sub = JSON.parse(Buffer.from(base64Url, 'base64').toString('ascii'));
        var tt = req.data.token_type; //here so i could do testing, now I don't want to remove it incase I break my stuff
        axios({
          method: 'GET',
          url: 'https://people.googleapis.com/v1/people/me?personFields=names',
          headers: {
            'Authorization': `${tt} ${a_token}`,
            'content-type': 'application/x-www-form-urlencoded',
            'accept': 'application/json',
            'Accept-Encoding':  '*'
          }
        }).then(async function(req,res){ //final response and saves the data and then renders it in a page
          resp_content.l_name = req.data.names[0].familyName;
          var temp = 0;

          var users = await get_users();
          if(users.length > 0){
            for(i = 0; i < users.length; i++){
                if(users[i].sub == sub.sub){
                    break;
                }
                if(i == (users.length - 1)){
                    post_user(req.data.names[0].givenName, req.data.names[0].familyName, sub.sub)
                }
              }
          }else{
            console.log(sub.sub);
            post_user(req.data.names[0].givenName, req.data.names[0].familyName, sub.sub)
          }


          resp_content.id_token = token ;
          res_1.render('data', resp_content);
        });
  
    }).catch(function (error, req, res) {
        console.log("Error:" + error)
        console.log(res);
    });
});
//https://stackoverflow.com/questions/27465850/typeerror-router-use-requires-middleware-function-but-got-a-object
module.exports = router;
module.exports = app; 