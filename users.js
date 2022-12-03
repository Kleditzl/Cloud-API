const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;

const USER = "User";


function get_users() {
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        // Use Array.map to call the function fromDatastore. This function
        // adds id attribute to every element in the array at element 0 of
        // the variable entities
        return entities[0].map(ds.fromDatastore);
    });
}

router.get('/', function(req, res){
    var accepts = req.accepts(['application/json']);
    if(accepts !== 'application/json'){
        res.status(406).json({"Error": "Not an acceptable request type."});
    }
    const users = get_users()
	.then( (users) => {
        res.status(200).json(users);
    });
});




module.exports = router;