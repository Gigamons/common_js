const bcrypt = require('bcrypt-nodejs');

function check (passhash, hash) {
    if(bcrypt.compareSync(hash, passhash)) return true;
    else return false;
}

function create(string){
    return bcrypt.hashSync(string);
}

module.exports = {
    check: check,
    create: create
};