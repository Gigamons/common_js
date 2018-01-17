const MySQL = require('../manager/mysql');
const redis = require('../manager/redis');
const passhelper = require('../helpers/passwordhelper');
const logger = require('../helpers/logger');
const eventtool = require('./event');

async function getuserid(username = 'Pepperony'){
    let s = username.replace(' ', '_');
    let safe = s.toLowerCase();
    let result = await MySQL.query('SELECT id FROM users WHERE username_safe=?', [safe]);
    if(result){
        if(result[0])
            return result[0].id
        else return false;
    }
}

async function getusername(userid = 0){
    let result = await MySQL.query('SELECT username, username_safe FROM users WHERE id=?', [userid]);
    if(result){
        if(result[0])
            return {
                username: result[0]['username'],
                username_safe: result[0]['username_safe']
            };
        else return false;
    }
}

async function checkAuth(userid = 0, passhashmd5 = ''){
    let result = await MySQL.query('SELECT password FROM users WHERE id=?', userid);
    return passhelper.check(result[0].password, passhashmd5)
}

async function checkLoggedIn(userid = 0, passhashmd5 = '') {
    return new Promise(async (resolve, reject) => {
        const idtouser = await getusername(userid);
        if(idtouser){
            redis.hexists('users_loggedin', idtouser.username_safe, async (err, reply) => {
                if(err) reject(false)
                else if(Boolean(reply)){
                    let res = await MySQL.query('SELECT password FROM users WHERE id=?', userid);
                    resolve(passhelper.check(res[0].password, passhashmd5));
                } else resolve(false);
            });
        } else resolve(false);
    });
}

async function getuser(userid = 0){
    let result = await MySQL.query('SELECT * FROM users WHERE id=? LIMIT 1', userid);
    let banned = false;
    return {
        UserID: Number(result[0].id),
        UserName: String(result[0].username),
        UserName_Safe: String(result[0].username_safe),
        EMail: String(result[0].email),
        Privileges: Number(result[0].privileges),
        Banned: {
            status: Boolean(result[0].banned),
            reason: String(result[0].ban_reason)
        },
        Silenced: {
            status: Number(result[0].silenced),
            reason: String(result[0].silence_reason)
        }
    }
}

async function banUser(userid = 0, reason = '') {
    await MySQL.query('UPDATE users SET banned=?, ban_reason=? WHERE userid=?', [1, reason, userid]);
    await eventtool.WriteKick(userid, 'Banned!');
    await eventtool.WriteMessage({
        from: 'BananaBot',
        to: '#announce',
        message: 'User "'+await getusername(userid)+'" got Banned becourse: "'+reason+'"'
    });
    return;
}

async function getLeaderBoard(userid = 0, gamemode = 0, relaxing = false){
    if(gamemode == 0)
        gamemode = "std";
    else if (gamemode == 1)
        gamemode = "taiko";
    else if (gamemode == 2)
        gamemode = "ctb";
    else if (gamemode == 3)
        gamemode = "mania";
    else return false;
    let result;
    if(relaxing) result = await MySQL.query('SELECT * FROM leaderboard_rx STRAIGHT_JOIN users ON leaderboard_rx.userid = users.id WHERE (users.banned < 1) ORDER BY pp_'+gamemode+' DESC, rankedscore_'+gamemode+' DESC')
    else result = await MySQL.query('SELECT * FROM leaderboard STRAIGHT_JOIN users ON leaderboard.userid = users.id WHERE (users.banned < 1) ORDER BY pp_'+gamemode+' DESC, rankedscore_'+gamemode+' DESC')

    for (let i = 0; i < result.length; i++) {
        const element = result[i];
        if(element.userid == userid)
            return [++i, element];
    }
}

module.exports = {
    getuserid,
    getusername,
    checkAuth,
    checkLoggedIn,
    banUser,
    getuser,
    getLeaderBoard
};