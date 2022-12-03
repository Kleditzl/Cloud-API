const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
const BOAT = "Boat"; 
const LOAD = "Load"; 
const app = express();
router.use(bodyParser.json());
app.use(express.json());
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');


//this is lifted from the node.js notes but modifed
const checkjwt =  jwt({
                    secret: jwksRsa.expressJwtSecret({
                        cache: true,
                        rateLimit: true,
                        jwksRequestsPerMinute: 100,
                        jwksUri: `https://www.googleapis.com/oauth2/v3/certs`
                    }),
                    issuer: `https://accounts.google.com`,
                    algorithms: ['RS256']
                });


/* ------------- Begin Lodging Model Functions ------------- */
function post_boats(name, type, length, owner) {
    var key = datastore.key(BOAT);
    const new_boat = { "name": name, "type": type, "length": length,"owner": owner, "loads": []};
    return datastore.save({ "key": key, "data": new_boat }).then(() => { return key });
}

function get_boats_req(req) {
    var q = datastore.createQuery(BOAT).limit(5);
    var results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
        results.items = entities[0].map(ds.fromDatastore).filter(item => item.owner === req.auth.sub);
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS){
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
        }
        return results;
    });
}

async function get_boats() {
    //.log("in get boats");
    const q = datastore.createQuery(BOAT);
    const entities = await datastore.runQuery(q);
    return entities[0].map(ds.fromDatastore);
}
function get_boat(id){
    const key = datastore.key([BOAT, parseInt(id,10)]); 
    return datastore.get(key); 
}

function delete_boat(id){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return datastore.delete(key);
}

function put_boat(name, type, length, id, owner, load){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    const boat = {"name": name, "type": type, "length": length,"owner": owner, "loads": load};
    return datastore.save({"key":key, "data":boat}).then(() => {return key});
}

function put_load(volume, item, creation_date, id){
    const key = datastore.key([LOAD, parseInt(id,10)]);
	const new_load = {"volume": volume, "item": item, "creation_date": creation_date, "carrier": []};
	return datastore.save({"key":key, "data":new_load}).then(() => {return key});
}

function patch_boat(name, type, length, id, owner, load){
    //.log("patch " + name);
    const key = datastore.key([BOAT, parseInt(id,10)]);
    const boat = {"name": name, "type": type, "length": length, "owner": owner, "loads": load};
    return datastore.save({"key":key, "data":boat}).then(() => { return key});
}

function test_name(name){
    //.log(typeof name);
    if(typeof name != "string"){
        return false;
    }
    if(name.length >= 1 && name.length < 21){
        return true;
    }
    return false;
}

function test_type(type){
    if(typeof type != "string"){
        return false;
    }
    if(type.length >= 1 && type.length < 21){
        return true;
    }
    return false;
}

function test_length(len){
    //.log(typeof len);
    if(typeof len != "number"){
        return false;
    }
    if(len >= 1 && len < 2000){
        return true;
    }
    return false;

}

function get_load(id){
    ////.log("get_load" + id);
    const key = datastore.key([LOAD, parseInt(id,10)]); 
    ////.log("get_load" + key);
    var ret = datastore.get(key); 
    return ret;
}

async function put_reservation(bid, lid, req){
    ////.log("making the boat have a load");
    const b_key = datastore.key([BOAT, parseInt(bid, 10)]);
    const l_key = datastore.key([LOAD, parseInt(lid, 10)]);
    const boats = await datastore.get(b_key);
    const loads = await datastore.get(l_key);
    //.log("boats", boats, "boats[0]",  boats[0]);

    if(boats[0] == null || l_key == null || loads[0] == null){
        ////.log("put_res, 404 boat");
        return 404;
    }
    if(boats[0].owner != req.auth.sub){
        return 401;
    }
    //.log(boats[0].loads, boats[0].loads.length);
    if(boats[0].loads !== undefined){
        for(var i = 0; i < boats[0].loads.length; i++){
            if(boats[0].loads.length != 0 && boats[0].loads[0].id == lid){
                return 403;
            }
        }
    }
 
    if( typeof(boats[0].loads) === 'undefined'){
        boats[0].loads = [];
    }
    var boat_json = {"id": lid, "self": req.protocol + "://" + req.get("host") + "/loads" + "/" + lid};
    boats[0].loads.push(boat_json);
    ////.log("boat", boats[0].loads);
    return datastore.save({"key":b_key, "data":boats[0]});
}

async function put_reservation_2(bid, lid, req){
    ////.log(bid, lid);
    const b_key = datastore.key([BOAT, parseInt(bid, 10)]);
    const l_key = datastore.key([LOAD, parseInt(lid, 10)]);
    const loads = await datastore.get(l_key);
    const boat = await datastore.get(b_key);
    ////.log(boat[0]);
    if(loads[0] == null || b_key == null){
        ////.log("put_res, 404 boat");
        return 404;
    }
    if(loads[0].carrier.length != 0 && loads[0].carrier[1] != bid ){
        ////.log(typeof(loads[0].carrier));
        ////.log(loads[0].carrier);
        return 403;
    }
    if(loads[0].carrier.length != 0 && loads[0].carrier[1] == bid ){
        ////.log(typeof(loads[0].carrier));
        ////.log(loads[0].carrier);
        return 403;
    }

    if( typeof(loads[0].carrier) === 'undefined'){
        loads[0].carrier = [];
    }
    var load_json = { "id": bid, "name": boat.name, "self": req.protocol + "://" + req.get("host") + "/boats" + "/" + bid};
    loads[0].carrier.push(load_json);
    return datastore.save({"key":l_key, "data":loads[0]});
}


async function delete_reservation(bid, lid, sub){
    //.log("making the boat have a load");
    const b_key = datastore.key([BOAT, parseInt(bid, 10)]);
    const l_key = datastore.key([LOAD, parseInt(lid, 10)]);
    const boats = await datastore.get(b_key);
    const loads = await datastore.get(l_key);
    if(boats[0].owner != sub){
        return 401;
    }
    if(boats[0] == null || l_key == null || loads[0] == null){
        //.log("delete_reservation put_res, 404 boat");
        return 404;
    }
    ////.log(boats[0].loads, boats[0].loads.length);
    if(boats[0].loads != undefined){
        for(var i = 0; i < boats[0].loads.length; i++){
            //var temp = boats[0].loads[i];
            if(boats[0].loads[i].id == lid){
                //.log("delete_reservation boats_loads[i] " + JSON.stringify(boats[0].loads[i], null, 2))
                var temp = delete boats[0].loads[i];
                ////.log("temp " + temp)
                return datastore.save({"key":b_key, "data":boats[0]})
            }
        }
    }

    return 404;
}

async function delete_reservation_2(bid, lid){
    const b_key = datastore.key([BOAT, parseInt(bid, 10)]);
    const l_key = datastore.key([LOAD, parseInt(lid, 10)]);
    const loads = await datastore.get(l_key);
    const boat = await datastore.get(b_key);
    //.log(boat[0]);
    if(loads[0] == null || b_key == null){
        //.log("put_res, 404 boat");
        return 404;
    }

    if(loads[0].carrier.length != 0 && loads[0].carrier[0].id != bid ){
        return 403;
    }
    //.log("loads[0].carrier[0] " +JSON.stringify(loads[0].carrier[0], null, 2))
    if(loads[0].carrier.length != 0 && loads[0].carrier[0].id != bid ){
        return 403;
    }
    var temp = delete loads[0].carrier[0];
    
    return datastore.save({"key":l_key, "data":loads[0]})

}

/* ------------- End Model Functions ------------- */
/* ------------- Begin Controller Functions ------------- */


router.post('/', checkjwt,async function(req, res, next){
    try{
        if(!checkjwt){
            res.status(401).send({"Error": "The token you provided is not authorized to perform this action."});
            return;
        }
        if(req.body.name != undefined){
            var ret = test_name(req.body.name)
            if(ret != true){
                res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                return;
            }
        }
        if(req.body.type != undefined){
            var ret = test_type(req.body.type)
            if(ret != true){
                res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                return;
            }
        }
        if(req.body.length != undefined){
            var ret = test_length(req.body.length)
            if(ret != true){
                res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                return;
            }
        }
        var accepts = req.accepts(['application/json']);
        if(!accepts){
            res.status(406).json({"Error": "Not an acceptable request type."});
            return;
        }
        if(req.get('content-type') !== 'application/json'){
            res.status(415).send({"Error": "Server only accepts application/json data."});
            return;
        }else{
            var test = 0;
            if(req.body.name == undefined || req.body.type == undefined || req.body.length == undefined){
                res.status(400).send('{"Error": "The request object is missing at least one of the required attributes"}');
            }else {
                var check = await check_boat_name(req);
                if(check == -1){
                    res.status(403).send('{"Error": "The name of the boat must be unique."}');
                    return;
                }else if(check != -1){
                        post_boats(req.body.name, req.body.type, req.body.length, req.auth.sub).then( key =>{
                            res.status(201).send('{"id": ' + key.id + ',\n "name": "' + req.body.name + '",\n "type": "' + req.body.type + '",\n "length": ' + req.body.length + ',\n "loads": ' + '[]' + ',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id + '"\n}')
                        });                      
                    }
                }
            }
        }
    catch(err){
        res.status(401).send({"Error": "The token you provided is not authorized to perform this action."});
        return;
    }
});


router.get('/:bid', checkjwt, async function(req, res, next){
    try{
        if(checkjwt){
            if(req.get('content-type') !== 'application/json'){
                res.status(415).send({"Error": "Server only accepts application/json data."});
                return;
            }
            const boats = await get_boat(req.params.bid);
            if(boats === undefined || boats[0] == undefined){
                res.status(404).json({"Error": "No boat with this boat_id exists"});
                return;
            }
            var accepts = req.accepts(['application/json']);
            if(!accepts){
                res.status(406).json({"Error": "Not an acceptable request type."});
                return;
            }else if(accepts === 'application/json'){
                if(boats[0].owner == req.auth.sub){
                    res.status(200).send(('{"id": ' + req.params.bid + ',\n "name": "' + boats[0].name + '",\n "type": "' + boats[0].type + '",\n "length": ' + boats[0].length +',\n "loads": ' + JSON.stringify(boats[0].loads, null, 2) + ',\n "owner": "' + req.auth.sub + '",\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.bid + '"\n}'));
                    return;
                }else{
                    res.status(401).send({"Error": "The token you provided is not authorized to view this boat."});
                    return;
                }
            } else { 
                res.status(500).send('Content type got messed up!'); 
                return;
            }
        }else{
            res.status(401).end({"Error": "The token you provided is not authorized to view this boat."});
            return;
        }
    }
    catch(err){
        res.status(401).send({"Error": "The token you provided is not authorized to view this boat."});
        return;
      } 
});

router.delete('/:bid', checkjwt, async function(req,res,next){
    try{
        const boat = await get_boat(req.params.bid);
        if(boat[0] == null){
            res.status(404).send('{"Error": "No boat with this boat_id exists"}');
            return;
        }else{
            ////.log(boat[0].owner, req.auth.sub);
            if(boat[0].owner != req.auth.sub){
                //.log("delete not authorized");
                res.status(401).end();
                return;
            }else{
                if(boat[0].loads !== undefined){
                    if(boat[0].loads.length != 0){
                        var loads = boat[0].loads;
                        for(var i = 0; i < loads.length; i++){
                            var id = loads[i].id;
                            var load = await get_load(id);
                            //.log(load);
                            if(load == undefined){
                                var ret = await put_load(load[0].volume, load[0].item, load[0].creation_date, id);
                            }                            
                        }
                    }
                    var ret = await delete_boat(req.params.bid).then(res.status(204).end());
                    return;
                }else{
                    var ret = await delete_boat(req.params.bid).then(res.status(204).end());
                    return;
                }
                
            }
            
        }  
    }
    catch(err){
        res.status(401).end();
    }
});

async function check_boat_name(req){
    const boats = await get_boats();
    //.log(boats[0]);
    //.log(boats);
    if(boats != undefined){
        //.log("boats[0] != undefined", boats.length)
        for(var i = 0; i < boats.length; i++){
            //.log(boats[i])
            if(req.body.name == boats[i].name){
                //.log("Same name")
                return -1;
            }
        }
        //.log("name not found!");
        return 1;
    }else if(boats[0] === undefined || !boats[0]){
        //.log("no boat");
        return 0;
    }else{
        ////.log("returning to the main put function");
        return 1;
    }
}

router.put('/:bid', checkjwt, async function(req, res){ //still need to do the check for the owner
    try{
        var accepts = req.accepts(['application/json']);
        if(!accepts){
            res.status(406).json({"Error": "Not an acceptable request type."});
            return;
        }
        if(req.get('content-type') !== 'application/json'){
            res.status(415).send({"Error": "Server only accepts application/json data."});
            return;
        }
        if(req.body.name != undefined){
            var ret = test_name(req.body.name);
            if(ret != true){
                res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                return;
            }
        }
        if(req.body.type != undefined){
            var ret = test_type(req.body.type);
            if(ret != true){
                res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                return;
            }
        }
        if(req.body.length != undefined){
            var ret = test_length(req.body.length);
            if(ret != true){
                res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                return;
            }
        }
        if(req.body.name == undefined || req.body.type == undefined || req.body.length == undefined){
            res.status(400).send('{"Error": "You must send at least all new attribute to update"}');
            return;
        }
        var boat = await get_boat(req.params.bid);
        //.log("boat",boat);
        if(boat === undefined || boat == null || boat == undefined || boat[0] == undefined){
            res.status(404).json({"Error": "No boat with this boat_id exists"});
            return;
        }
        if(boat[0].owner != req.auth.sub){
            res.status(401).send('{"Error": "No token found, or the token provided did not give you clearance to perform this action."}'); 
            return;
        }
        var check = await check_boat_name(req);
        //.log(check + " check");
        if(check == 0){
            res.status(404).json({"Error": "No boat with this boat_id exists"});
            return;
        }else if(check == -1){
            res.status(403).send('{"Error": "The name of the boat must be unique."}');
            return;
        }else if(check == 1){

            //.log("put boat");
            var key = await put_boat(req.body.name, req.body.type, req.body.length, req.params.bid, req.auth.sub, boat[0].loads);
            //.log("put_boat again");
            res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);
            res.status(303).send('Location Header Updated').end(); 
            return;
        }
    }
    catch(err){
        res.status(401).send('{"Error": "No token found, or the token provided did not give you clearance to perform this action."}'); 
        return
    }
});

router.delete('/', checkjwt, function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.put('/', checkjwt, function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.patch('/', checkjwt, function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

function test_inp(name, length, type){
    a = [0,0,0];
    var test = [0,0,0];
    if(name != undefined){
        test[0] += 1;
    }
    if(length != undefined){
        test[1] += 1;
    }
    if(type != undefined){
        test[2] += 1;
    }
    //.log(test);
    var temp = 0;
    for(var i = 0; i < 3; i++){
        if(test[i] == 1){
            temp += 1;
        }
    }
    if(temp == 0){
        return 0;
    }else if(temp == 3){
        return 1;
    }
    return test;
}

router.patch('/:bid', checkjwt, async function(req, res, next){ 
    try{
        if(checkjwt){
            //.log(req.get('content-type'));
            var accepts = req.accepts(['application/json']);
            if(!accepts){
                res.status(406).json({"Error": "Not an acceptable request type."});
                return;
            }
            if(req.get('content-type') !== 'application/json'){
                res.status(415).send({"Error": "Server only accepts application/json data."});
                return;
            }
            if(req.body.name != undefined){
                var ret = test_name(req.body.name);
                if(ret != true){
                    res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                    return;
                }
            }
            if(req.body.type != undefined){
                var ret = test_type(req.body.type);
                if(ret != true){
                    res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                    return;
                }
            }
            if(req.body.length != undefined){
                var ret = test_length(req.body.length);
                if(ret != true){
                    res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
                    return;
                }
            }
            const test = test_inp(req.body.name, req.body.length, req.body.type);
                
            if(test != 0 && test != 1) {
                ////.log("test = " + test);
                var boat = await get_boat(req.params.bid);
                //.log(boat[0].owner, boat.owner, req.auth.sub);
                if(boat[0].owner != req.auth.sub){
                    //.log("patch not authorized");
                    res.status(401).send('{"Error": "No token found, or the token provided did not give you clearance to perform this action."}'); 
                    return;
                }
                if(boat[0] == undefined){
                    res.status(404).json({"Error": "No boat with this boat_id exists"});
                    return;
                }
                if(req.body.name != undefined && req.body.length == undefined && req.body.type == undefined){ //100
                    //.log(req.body.name);
                    try{
                        const new_b = await patch_boat(req.body.name, boat[0].type, boat[0].length, req.params.bid, req.auth.sub, boat[0].loads);
                        res.status(200).send(('{"id": ' + req.params.bid + ',\n "name": "' + req.body.name+ '",\n "type": "' + boat[0].type + '",\n "length": ' + boat[0].length + ',\n "loads": ' + boat[0].loads + ',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.bid + '"\n}'));
                        return;
                    }catch{
                        res.status(500).json({"Error": "Something went wrong patching the boat"}); 
                        return;
                    }
                }else if(req.body.name == undefined && req.body.length != undefined && req.body.type == undefined){ //010
                    try{
                        //.log("did work");
                        const new_b = await patch_boat(boat[0].name, boat[0].type, req.body.length, req.params.bid, req.auth.sub, boat[0].loads);
                        //.log("sending status");
                        res.status(200).send(('{"id": ' + req.params.bid + ',\n "name": "' + boat[0].name + '",\n "type": "' + boat[0].type + '",\n "length": ' + req.body.length + ',\n "loads": ' + boat[0].loads +',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.bid + '"\n}'));
                        return;
                    }catch{
                        res.status(500).json({"Error": "Something went wrong patching the boat"}); 
                        return;
                    }
                }else if(req.body.name == undefined && req.body.length == undefined && req.body.type != undefined){ //001
                    try{
                        const new_b = await patch_boat(boat[0].name, req.body.type, boat[0].length, req.params.bid, req.auth.sub, boat[0].loads);
                        res.status(200).send(('{"id": ' + req.params.bid + ',\n "name": "' + boat[0].name+ '",\n "type": "' + req.body.type + '",\n "length": ' + boat[0].length + ',\n "loads": ' + boat[0].loads +',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.bid + '"\n}'));
                        return;
                    }catch{
                        res.status(500).json({"Error": "Something went wrong patching the boat"}); 
                        return;
                    }
                }else if(req.body.name != undefined && req.body.length != undefined && req.body.type == undefined){ //110
                    try{
                        const new_b = await patch_boat(req.body.name, boat[0].type, req.body.length, req.params.bid, req.auth.sub, boat[0].loads);
                        res.status(200).send(('{"id": ' + req.params.bid + ',\n "name": "' + req.body.name+ '",\n "type": "' + boat[0].type + '",\n "length": ' + req.body.length + ',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.bid + '"\n}'));
                        return;
                    }catch{
                        res.status(500).json({"Error": "Something went wrong patching the boat"}); 
                        return;
                    }
                }else if(req.body.name != undefined && req.body.length == undefined && req.body.type != undefined){ //101
                    try{
                        const new_b = await patch_boat(req.body.name, req.body.type, boat[0].length, req.params.bid, req.auth.sub, boat[0].loads);
                        res.status(200).send(('{"id": ' + req.params.bid + ',\n "name": "' + req.body.name+ '",\n "type": "' + req.body.type + '",\n "length": ' + boat[0].length + ',\n "loads": ' + boat[0].loads +',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.bid + '"\n}'));
                        return;
                    }catch{
                        res.status(500).json({"Error": "Something went wrong patching the boat"}); 
                        return;
                    }
                }else if(req.body.name == undefined && req.body.length != undefined && req.body.type != undefined){ //011
                    try{
                        const new_b = patch_boat(boat[0].name, req.body.type, req.body.length, req.params.bid, req.auth.sub, boat[0].loads);
                        res.status(200).send(('{"id": ' + req.params.bid + ',\n "name": "' + req.body.name + '",\n "type": "' + req.body.type + '",\n "length": ' + req.body.length + ',\n "loads": ' + boat[0].loads +',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.bid + '"\n}'));
                        return;
                    }catch{
                        res.status(500).json({"Error": "Something went wrong patching the boat"}); 
                        return;
                    }
                }else{
                    res.status(400).json({"Error": "Invalid attributes, can only update a subset"});
                    return;   
                }
            }else{
                res.status(400).json({"Error": "Invalid attributes, can only update a subset"});
                return;
            }
        }
        else{
            ////.log("checkjwt failed?");
            res.status(401).send('{"Error": "No token found, or the token provided did not give you clearance to perform this action."}'); 
        }
    }
    catch(err){
        res.status(401).send('{"Error": "No token found, or the token provided did not give you clearance to perform this action."}'); 
        return;
        
    }
    
});

router.get('/', checkjwt, function(req, res,next){
    try{
        var accepts = req.accepts(['application/json']);
        if(accepts !== 'application/json'){
            res.status(406).json({"Error": "Not an acceptable request type."});
            return;
        }
        if(req.get('content-type') !== 'application/json'){
            res.status(415).send({"Error": "Server only accepts application/json data."});
            return;
        }
        const boats = get_boats_req(req)
        .then( (boats) => {
            res.status(200).json(boats);
            return;
        });
    }
    catch(err){
        res.status(401).send({"Error": "No token found, or the token provided did not give you clearance to perform this action."});
        return;
    }

});

router.put('/:bid/loads/:lid', checkjwt, async function(req, res){
    try{
        var accepts = req.accepts(['application/json']);
        if(accepts !== 'application/json'){
            res.status(406).json({"Error": "Not an acceptable request type."});
            return;
        }
        if (req.params.bid == null || req.params.lid == null) {
            res.status(404).send('{"Error": "No boat with this boat_id exists, and/or no load with this load_id exits"}');
            return;
        }
        if(req.body.name == undefined )
        var ret_1 = await put_reservation(req.params.bid, req.params.lid, req); //send req.protocol, req.get("host"), /load/load_id
        ////.log("back from ret_1 " + ret_1);
        var ret_2 = await put_reservation_2(req.params.bid, req.params.lid, req); //send req.protocol, req.get("host"), /boats/boat_id
        //.log(ret_1, ret_2);
        if(ret_1 == 401){
            res.status(401).send('{"Error": "No token found, or the token provided did not give you clearance to perform this action."}'); 
            return;
        }
    
        if(ret_1== 404 || ret_2 == 404){
            res.status(404).send('{"Error": "The specified boat and/or load does not exist"}');
            return;
        }else if(ret_2 == 403 || ret_1 == 403){
            res.status(403).send('{"Error": "The load is already loaded on another boat"}');
            return;
        }else{
            res.status(204).send("Success");
            return;
        }
    }catch(err){
        res.status(401).send('{"Error": "No token found, or the token provided did not give you clearance to perform this action."}'); 
        return;
    }
    
});

router.delete('/:bid/loads/:lid', checkjwt, async function(req, res){
    if (req.params.bid == null || req.params.lid == null) {
        res.status(404).send('{"Error": "No boat with this boat_id exists, and/or no load with this load_id exits"}')
    }
    var ret_1 = await delete_reservation(req.params.bid, req.params.lid,req.auth.sub); //send req.protocol, req.get("host"), /load/load_id
    ////.log("back from ret_1 " + ret_1);
    var ret_2 = await delete_reservation_2(req.params.bid, req.params.lid); //send req.protocol, req.get("host"), /boats/boat_id
    //.log("router.delete ret1 " + ret_1, "ret2 " + ret_2);
    if(ret_1 == 401){
        res.status(401).send('{"Error": "No token found, or the token provided did not give you clearance to perform this action."}'); 
        return;
    }
    if(ret_1== 404 || ret_2 == 404){
        res.status(404).send('{"Error": "No boat with this boat_id is loaded with the load with this load_id"}');
        return;
    }else if(ret_2 == 403 || ret_1 == 403){
        //.log(ret_2)
        res.status(403).send('{"Error": "The load isnt assigned to this boat"}');
        return;
    }else{
        res.status(204).send("Success");
        return;
    }
});

/* ------------- End Controller Functions ------------- */
//https://stackoverflow.com/questions/27465850/typeerror-router-use-requires-middleware-function-but-got-a-object
module.exports = router;
