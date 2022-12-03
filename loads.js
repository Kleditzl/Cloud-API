const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();

const ds = require('./datastore');

const datastore = ds.datastore;

const LOAD = "Load"; 
const BOAT = "Boat"

router.use(bodyParser.json());
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');

//this is lifted from the node.js notes but modifed
const checkjwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 100,
      jwksUri: `https://www.googleapis.com/oauth2/v3/certs`
    }),
    issuer: `https://accounts.google.com`,
    algorithms: ['RS256']
  });

/* ------------- Begin guest Model Functions ------------- */

function get_loads(req){
    var q = datastore.createQuery(LOAD).limit(5);
    var results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
        results.items = entities[0].map(ds.fromDatastore);
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
        }
        return results;
    });
}

function get_load(id){
    const key = datastore.key([LOAD, parseInt(id,10)]); 
    var ret = datastore.get(key); 
    return ret;
}

function post_load(volume, item, creation_date){
    ////.log(volume,item,creation_date);
    var key = datastore.key(LOAD);
	const new_load = {"volume": volume, "item": item, "creation_date": creation_date, "carrier": []};
	return datastore.save({"key":key, "data":new_load}).then(() => {return key});
}

function delete_load(id){
    const key = datastore.key([LOAD, parseInt(id,10)]);
    ////.log("delete load " + key);
    return datastore.delete(key);
}

function patch_load(volume, item, creation_date, id, carrier){
    //.log(volume, item, creation_date, id, carrier)
    const key = datastore.key([LOAD, parseInt(id,10)]);
    const load = {"volume": volume, "item": item, "creation_date": creation_date, "carrier": carrier};
    return datastore.save({"key":key, "data":load}).then(() => { return key});
}

function put_load(volume, item, creation_date, id, carrier){
    const key = datastore.key([LOAD, parseInt(id,10)]);
	const new_load = {"volume": volume, "item": item, "creation_date": creation_date, "carrier": carrier};
	return datastore.save({"key":key, "data":new_load}).then(() => {return key});
}

function test_item(name){
    //.log(typeof name);
    if(typeof name != "string"){
        return false;
    }
    if(name.length >= 1 && name.length < 21){
        return true;
    }
    return false;
}

function test_date(type){
    if(typeof type != "string"){
        return false;
    }
    else{
        return true;
    }
}

function test_volume(len){
    //.log(typeof len);
    if(typeof len != "number"){
        return false;
    }
    if(len >= 1 && len < 2000){
        return true;
    }
    return false;

}

function put_boat(name, type, length, id, owner, load){
    ////.log("put_boat before key");
    const key = datastore.key([BOAT, parseInt(id,10)]);
    ////.log("put_boat " + key.id);
    const boat = {"name": name, "type": type, "length": length,"owner": owner, "loads": load};
    ////.log("put_boat " + boat);
    return datastore.save({"key":key, "data":boat}).then(() => {return key});
}

function get_boat(id){
    const key = datastore.key([BOAT, parseInt(id,10)]); 
    return datastore.get(key); 
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */
router.get('/', function(req, res){
    var accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({"Error": "Not an acceptable request type."});
        return;
    }
    const loads = get_loads(req)
	.then( (loads) => {
        res.status(200).json(loads);
        return;
    });
});

router.get('/:lid', async function(req,res){
    var accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({"Error": "Not an acceptable request type."});
        return;
    }
    const load = await get_load(req.params.lid)
    if(load[0] == null){
        res.status(404).json({"Error": "No load with this load_id exists"});
        return;
    }else{
        if(load[0].carrier == [] || load[0].carrier == null){   
            res.status(200).send('{"id": ' + req.params.lid+ ',\n "volume": ' + load[0].volume + ',\n "item": "' + load[0].item + '",\n "creation_date": "' + load[0].creation_date + '",\n "carrier": "'+ [] + '",\n "self": "' + req.protocol + "://" + req.hostname + req.baseUrl + "/" + req.params.lid + '"\n}')         
            return;
        } //boat[0].loads == [] || boats[0].loads == null
        else{
            res.status(200).send('{"id": ' + req.params.lid+ ',\n "volume": ' + load[0].volume + ',\n "item": "' + load[0].item + '",\n "creation_date": "' + load[0].creation_date + '",\n "carrier":  '+ JSON.stringify(load[0].carrier, null, 2) + ',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.lid + '"\n}')
            return;
        }
    }

});

router.post('/',function(req, res, next){
    var accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({"Error": "Not an acceptable request type."});
        return;
    }
    if(req.get('content-type') !== 'application/json'){
        res.status(415).send({"Error": "Server only accepts application/json data."})
    }
    if (req.body.volume == null || req.body.item == null || req.body.creation_date == null) {
        res.status(400).send('{"Error": "The request object is missing at least one of the required attributes"}')
    }
    else {
        post_load(req.body.volume, req.body.item, req.body.creation_date)
        .then( key => {
            res.status(201).send('{"id": ' + key.id + ',\n "volume": ' + req.body.volume + ',\n "item": "' + req.body.item + '",\n "creation_date": "' + req.body.creation_date + '",\n "carrier": ' + null + ',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id + '"\n}')
        });
    }

});

router.delete('/:id', async function(req, res){
    var load = await get_load(req.params.id);
    //.log("load", load[0]);
    if(load[0] == null){
        res.status(404).send('{"Error": "No load with this load_id exists"}');
        return;
    }else{
        //.log(load[0].carrier.length)
        if(load[0].carrier.length){
            var boat = load[0].carrier[0];
            var id = boat.id;
            var boat= await get_boat(id);
            if(boat[0]){
                //.log("boat", boat);
                for(var i = 0; i < boat[0].loads.length; i++){
                    if(boat[0].load[i].id == load[0].id){
                        boat[0].loads = delete boat[0].loads[i];
                    }
                }
                var ret = await put_boat(boat[0].name, boat[0].type, boat[0].length, id, boat[0].owner, boat[0].loads);
            }
                      
        }
        delete_load(req.params.id).then(() => {
            res.status(204).end()
            return;
        });
        return;
    }
    
});

//volume, item, creation_date
router.put('/:lid',async function(req, res){ //still need to do the check for the owner
    var accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({"Error": "Not an acceptable request type."});
        return;
    }
    if(req.get('content-type') !== 'application/json'){
        res.status(415).send({"Error": "Server only accepts application/json data."});
        return;
    }
    if(req.body.creation_date == undefined || req.body.volume == undefined || req.body.item == undefined){
        res.status(400).send('{"Error": "You must send at least all new attribute to update"}');
        return;
    }
    if(req.body.volume != undefined){
        var ret = test_volume(req.body.volume);
        if(ret != true){
            res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
            return;
        }
    }
    if(req.body.item != undefined){
        var ret = test_item(req.body.item);
        if(ret != true){
            res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
            return;
        }
    }
    if(req.body.creation_date != undefined){
        var ret = test_date(req.body.creation_date);
        if(ret != true){
            res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
            return;
        }
    }

    var load = await get_load(req.params.lid);

    if(load === undefined || load[0] == undefined){ 
        res.status(404).json({"Error": "No load with this load_id exists"});
        return;
    }else{
        //.log("put boat");
        if(load[0].carrier.length >= 1){
            var key = await put_load(req.body.volume, req.body.item, req.body.creation_date, req.params.lid, load[0].carrier);
        }else{
            var key = await put_load(req.body.volume, req.body.item, req.body.creation_date, req.params.lid, []);
        }
       //.log("put_boat again");
       res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);
       res.status(303).send('Location Header Updated').end(); 
       return;
   }
});

function test_inp(volume, item, creation_date){
    a = [0,0,0];
    var test = [0,0,0];
    if(volume != undefined){
        test[0] += 1;
    }
    if(item != undefined){
        test[1] += 1;
    }
    if(creation_date != undefined){
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

router.patch('/:lid',async function(req, res, next){ 
    if(req.get('content-type') !== 'application/json'){
        res.status(415).send({"Error": "Server only accepts application/json data."});
        return;
    }
    if(req.body.volume != undefined){
        var ret = test_volume(req.body.volume);
        if(ret != true){
            res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
            return;
        }
    }
    if(req.body.item != undefined){
        var ret = test_item(req.body.item);
        if(ret != true){
            res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
            return;
        }
    }
    if(req.body.creation_date != undefined){
        var ret = test_date(req.body.creation_date);
        if(ret != true){
            res.status(400).send({"Error": "One of the attributes are in the incorrect type"});
            return;
        }
    }
    const test = test_inp(req.body.volume, req.body.item, req.body.creation_date);
        
    if(test != 0 && test != 1) {
        ////.log("test = " + test);
        var load = await get_load(req.params.lid);
        //.log(boat[0].owner, boat.owner, req.auth.sub);
        if(load[0] == undefined){
            res.status(404).json({"Error": "No load with this load_id exists"});
            return;
        }
        if(req.body.volume != undefined && req.body.item == undefined && req.body.creation_date == undefined){ //100
            //.log(req.body.name);
            try{
                const new_b = await patch_load(req.body.volume, load[0].item, load[0].creation_date, req.params.lid, load[0].carrier);
                res.status(200).send(('{"id": ' + req.params.lid + ',\n "volume": "' + req.body.volume + '",\n "item": "' + load[0].item + '",\n "creation_date": ' + load[0].creation_date + ',\n "carrier": ' + load[0].carrier + ',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.lid + '"\n}'));
                return;
            }catch{
                res.status(500).json({"Error": "Something went wrong patching the load"}); 
                return;
            }
        }else if(req.body.volume == undefined && req.body.item != undefined && req.body.creation_date == undefined){ //010
            try{
                //.log("did work");
                const new_b = await patch_load(load[0].volume, req.body.item, load[0].creation_date, req.params.lid, load[0].carrier);
                //.log("sending status");
                res.status(200).send(('{"id": ' + req.params.lid + ',\n "volume": "' + load[0].volume + '",\n "item": "' + req.body.item + '",\n "creation_date": ' + load[0].creation_date + ',\n "carrier": ' + load[0].carrier +',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.lid + '"\n}'));
                return;
            }catch{
                res.status(500).json({"Error": "Something went wrong patching the load"}); 
                return;
            }
        }else if(req.body.volume == undefined && req.body.item == undefined && req.body.creation_date != undefined){ //001
            try{
                const new_b = await patch_load(load[0].volume, load[0].item, req.body.creation_date, req.params.lid, load[0].carrier);
                res.status(200).send(('{"id": ' + req.params.lid + ',\n "volume": "' + load[0].volume + '",\n "item": "' + load[0].item + '",\n "creation_date": ' +req.body.creation_date + ',\n "carrier": ' + load[0].carrier + ',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.lid + '"\n}'));
                return;
            }catch{
                res.status(500).json({"Error": "Something went wrong patching the load"}); 
                return;
            }
        }else if(req.body.volume != undefined && req.body.item != undefined && req.body.creation_date == undefined){ //110
            try{
                const new_b = await patch_load(req.body.volume, req.body.item, load[0].creation_date, req.params.lid, load[0].carrier);
                res.status(200).send(('{"id": ' + req.params.lid + ',\n "volume": "' + req.body.volume + '",\n "item": "' + req.body.item + '",\n "creation_date": ' + load[0].creation_date + ',\n "carrier": ' + load[0].carrier + ',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.lid + '"\n}'));
                return;
            }catch{
                res.status(500).json({"Error": "Something went wrong patching the load"}); 
                return;
            }
        }else if(req.body.volume != undefined && req.body.item == undefined && req.body.creation_date != undefined){ //101
            try{
                const new_b = await patch_load(req.body.volume, load[0].item, req.body.creation_date, req.params.lid, load[0].carrier);
                res.status(200).send(('{"id": ' + req.params.lid + ',\n "volume": "' + req.body.volume+ '",\n "item": "' + load[0].item + '",\n "creation_date": ' + req.body.creation_date + ',\n "carrier": ' + load[0].carrier +',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.lid + '"\n}'));
                return;
            }catch{
                res.status(500).json({"Error": "Something went wrong patching the load"}); 
                return;
            }
        }else if(req.body.volume == undefined && req.body.item != undefined && req.body.creation_date != undefined){ //011
            try{
                const new_b = patch_load(load[0].volume, req.body.item, req.body.creation_date, req.params.lid, load[0].carrier);
                res.status(200).send(('{"id": ' + req.params.lid + ',\n "volume": "' + load[0].volume + '",\n "item": "' + req.body.item + '",\n "creation_date": ' + req.body.creation_date + ',\n "carrier": ' + load[0].carrier +',\n "self": "' + req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.lid + '"\n}'));
                return;
            }catch{
                res.status(500).json({"Error": "Something went wrong patching the load"}); 
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
    
});

/* ------------- End Controller Functions ------------- */

//https://stackoverflow.com/questions/27465850/typeerror-router-use-requires-middleware-function-but-got-a-object
module.exports = router;