var fs = require('fs');
const DORGE = "440753792";
const FUJI = "532735068";
const DEBUGCHANNEL = "-1001397346553";
const ANNOUNCECHANNEL = "-1001239173779";
const SGN = "-1001156677558";
const admins = [DORGE];
const holoAPIKey = JSON.parse(fs.readFileSync("/home/pi/Hololive/apikey"));
const twitterAPIBearer = JSON.parse(fs.readFileSync("/home/pi/Hololive/twitterbearer"));
const identifiers = [
    "hb",
    "holobot",
    "holodexbot",
    "@holodexbot"
];
var bot = require('./botapi.js');
var fileCache = {};
fileCache['commands'] = [];
fileCache['ids'] = [];
fileCache['tweets'] = [];
fileCache['streams'] = [];
var bootloaderData;
exports.token = null;
exports.name = "HolodexBot";
exports.directory = "";
var intervalsActive = [];
var timeoutsActive = [];
var currentLoopTimeout;
var announcementTimeouts = [];

function loadFileCache() {
    fileCache['commands'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/commands.json'));
    fileCache['ids'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/HoloIDs.json'));
    fileCache['tweets'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/tweets.json'));
    fileCache['streams'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/streams.json'));
}

function writeTweets() {
    fs.writeFileSync("./" + exports.directory + '/tweets.json', JSON.stringify(fileCache['tweets']));
}

function writeStreams() {
    fs.writeFileSync("./" + exports.directory + '/streams.json', JSON.stringify(fileCache['streams']));
}

exports.init = function(initData) {
    bootloaderData = initData;
    bootloaderData.initBotFunc(exports.directory);
    bot.setToken(exports.token);
    bot.sendMessage(DEBUGCHANNEL, "HolodexBot is ON");
    loadFileCache();
}

function forHolodexBot(msg) {
    for (let i = 0; i < identifiers.length; i++) {
        if (msg.text.toLowerCase().includes(identifiers[i])) {
            if (msg.text.toLowerCase().indexOf(identifiers[i]) == 0) {
                return true;
            }
        }
    }
    return false;
}

exports.callback = function(message) {
    //Un-comment to have the bot echo file IDs to the console. Useful when webhooks are enabled and we can't get IDs from a browser
    // if (message.hasOwnProperty('photo')) {
    //     console.log(message.photo[message.photo.length-1].file_id);
    // }
    // else if (message.hasOwnProperty('animation')) {
    //     console.log(message.animation.file_id);
    // }
    //Un-comment to have the bot process edited messages
    // if (message.hasOwnProperty('edited_message')) {
    //     processMessage(message.edited_message);
    // }
    if (message.hasOwnProperty("message")) {
        processMessage(message.message);
    }
}

function pekofy(msg) {
    if (msg.text.toLowerCase() != "!pekofy") {
        return;
    }
    if (!msg.hasOwnProperty("reply_to_message")) {
        bot.sendReply(msg.chat.id, 'Pardun?', msg.message_id);
        return;
    }
    else if (!msg.reply_to_message.hasOwnProperty("text")) {
        let textReplaceFailed = true;
        if (msg.reply_to_message.hasOwnProperty("photo")) {
            if (msg.reply_to_message.photo.hasOwnProperty("caption")) {
                msg.reply_to_message.text = msg.reply_to_message.photo.caption;
                textReplaceFailed = false;
            }
            else if (msg.reply_to_message.hasOwnProperty("caption")) {
                msg.reply_to_message.text = msg.reply_to_message.caption;
                textReplaceFailed = false;
            }
        }
        if (textReplaceFailed) {
            bot.sendReply(msg.chat.id, 'Incorrect message format peko', msg.message_id);
            return;
        }
    }
    let toPeko = msg.reply_to_message.text;
    let lastChar = "";
    let punctArray = [".","?","!"];
    let allPunct = [];
    for (let i = 0; i < punctArray.length; i++) {
        if (toPeko.substr(toPeko.length - 1) == punctArray[i]) {
            lastChar = punctArray[i];
        }
        if (toPeko.includes(punctArray[i])) {
            for (let j = 0; j < toPeko.length; j++) {
                if (toPeko[j] == punctArray[i]) {
                    allPunct.push(j);
                }
            }
        }
    }
    let pekofied = "";
    if (allPunct.length == 0) {
        pekofied = toPeko + " peko";
    }
    else if (allPunct.length == 1 && lastChar != "") {
        pekofied = toPeko.substr(0, toPeko.length - 1) + " peko" + lastChar;
    }
    else {
        pekofied = toPeko;
        for (let i = 0; i < allPunct.length; i++) {
            pekofied = pekofied.substr(0, allPunct[i] + 5 * i) + " peko" + pekofied.substr(allPunct[i] + 5 * i)
        }
        if (lastChar == "") {
            pekofied += " peko";
        }
    }
    bot.sendMessage(msg.chat.id, pekofied);
}

function processMessage(message) {
    if (!message.hasOwnProperty('text') && message.hasOwnProperty('caption')) {
        message.text = message.caption;
    }
    if (!message.hasOwnProperty('text')) {
        return;
    }
    // Determine whether we need to acknowledge the message
    if (!forHolodexBot(message)) {
        // Check for pekofy
        pekofy(message);
        return;
    }
    // Check to see if any of the messages match a command
    let messageProcessed = false;
    let commandFound = false;
    for (let i = 0; i < fileCache['commands'].length; i++) {
        if (commandFound) {
            break;
        }
        for (let j = 0; j < fileCache['commands'][i].command_names.length; j++) {
            if (message.text.toLowerCase().includes(fileCache['commands'][i].command_names[j])) {
                processCommand(fileCache['commands'][i], message);
                messageProcessed = true;
                commandFound = true;
                break;
            }
        }
    }
    if (!messageProcessed) {
        bot.sendReply(message.chat.id, "Pardun?", message.message_id);
    }
}

function isAdmin(message) {
    for (let i = 0; i < admins.length; i++) {
        if (message.from.id == admins[i]) {
            return true;
        }
    }
    return false;
}

function shutdown(msg) {
    shutdownChatId = msg.chat.id;
    shutdownReplyId = msg.msg_id;
    bootloaderData.killFunc(exports.token);
}

exports.onKill = function() {
    for (let i = 0; i < intervalsActive.length; i++) {
        clearInterval(intervalsActive[i]);
    }
    for (let i = 0; i < timeoutsActive.length; i++) {
        clearTimeout(timeoutsActive[i]);
    }
    bot.sendMessage(shutdownChatId, "I'm die, thank you forever", shutdownReplyId);
    bot.sendMessage(DEBUGCHANNEL, "HolodexBot is OFF");
}

function doUptime(msg) {
    var uptime = Math.floor(process.uptime());
    var hours   = Math.floor(uptime / 3600);
    var minutes = Math.floor((uptime - (hours * 3600)) / 60);
    var seconds = uptime - (hours * 3600) - (minutes * 60);
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    bot.sendReply(msg.chat.id, "I've been working for "+hours+':'+minutes+':'+seconds, msg.msg_id);
}

async function processCommand(command, message) {
    if (command.requires_admin) {
        if (!isAdmin(message)) {
            bot.sendreply(message.chat.id, "You are unauthorized to access this command. For more information, contact @Dorge47", message.message_id);
            bot.sendMessage(DEBUGCHANNEL, `User ${message.from.username} attempted to access an unauthorized command`);
            return;
        }
    }
    switch (command.command_type) {
        //Simple message
        case 0:
            bot.sendReply(message.chat.id, command.command_data, message.message_id);
            break;
        case 6:
            bot.sendLink(message.chat.id, command.command_data.text,
                command.command_data.link, message.message_id,
                command.command_data.disablePreview);
            break;
        case 7:
            let memberData = fileCache['ids'][command.command_data];
            let holoDat = await bot.getFutureVids(holoAPIKey, memberData.id, true);
            let holodexData = JSON.parse(holoDat);
            if (holodexData.length == 0) {
                bot.sendReply(message.chat.id, (memberData.name + " has no streams scheduled right now."), message.message_id);
                break;
            }
            let currentlyLive = false;
            let livestreamIndex = null;
            for (let i = 0; i < holodexData.length; i++) {
                if (holodexData[i].status == "live") {
                    livestreamIndex = i;
                    currentlyLive = true;
                    bot.sendReply(message.chat.id, (memberData.name + " is live right now!"), message.message_id);
                    break;
                }
            }
            if (!currentlyLive) {
                bot.sendReply(message.chat.id, (memberData.name + " has " + holodexData.length + " upcoming " + ((holodexData.length - 1) ? "streams. Here's the first one:" : "stream. Here it is:")), message.message_id);
                setTimeout(function(){bot.sendReply(message.chat.id, ("https://youtu.be/" + holodexData[0].id), message.message_id)}, 300);
            }
            else {
                // Delay and list current livestreams
                setTimeout(function(){bot.sendReply(message.chat.id, ("https://youtu.be/" + holodexData[livestreamIndex].id), message.message_id)}, 300);
            }
            break;
        //Hardcoded commands
        //Help
        case 257:
            shutdown(message);
            break;
        case 260://Refreshes the file cache so we don't have to restart the bot
            loadFileCache();
            bot.sendReply(message.chat.id, command.command_data.replyText, message.message_id);
            break;
		case 262://Uptime
            doUptime(message);
            break;
        case 263://Clears all intervals and timeouts
            for (let i = 0; i < intervalsActive.length; i++) {
                clearInterval(intervalsActive[i]);
            }
            for (let i = 0; i < timeoutsActive.length; i++) {
                clearTimeout(timeoutsActive[i]);
            }
            setTimeout(function(){
                intervalsActive = [];
                timeoutsActive = [];
                currentLoopTimeout = "";
                announcementTimeouts = [];
            }, 3000);
            bot.sendReply(message.chat.id, "All intervals and timeouts cleared", message.message_id);
            break;
        default:
            console.error("Somehow there's a command of unknown type");
            break;
    }
}

async function checkForNewTweets(twitterId, chatId) {
    var latestTweetRaw = await bot.getTweets(twitterAPIBearer, twitterId, 3);
    var latestTweet = JSON.parse(latestTweetRaw);
    for (let i = 0; i < fileCache['tweets'].length; i++) {
        if (fileCache['tweets'][i]['uid'] == twitterId) {
            if (fileCache['tweets'][i]['tid'] != latestTweet.data[0].id) {
                fileCache['tweets'][i]['tid'] = latestTweet.data[0].id;
                writeTweets();
                let tweetLink = "https://twitter.com/i/web/status/" + latestTweet.data[0].id;
                bot.sendMessage(chatId, tweetLink);
            }
            return;
        }
    }
    var tweetToPush = {};
    tweetToPush['uid'] = twitterId;
    console.log(latestTweet);
    tweetToPush['tid'] = latestTweet.data[0].id;
    fileCache['tweets'].push(tweetToPush);
    writeTweets();
    return;
}

function announceStream(timeoutToClear, channelId) {
    let streamerName = "";
    for (let i = 0; i < fileCache['ids'].length; i++) {
        if (fileCache['ids'][i].id == channelId) {
            streamerName = fileCache['ids'][i].name;
        }
    }
    bot.sendMessage(ANNOUNCECHANNEL, (streamerName + " is live!\n\nhttps://youtu.be/" + timeoutToClear));
    for (let i = 0; i < announcementTimeouts.length; i++) {
        if (announcementTimeouts[i][1] == timeoutToClear) {
            clearTimeout(announcementTimeouts[i][0]);
            timeoutsActive = timeoutsActive.filter(timeout => timeout != announcementTimeouts[i][0]);
            announcementTimeouts = announcementTimeouts.filter(timeout => timeout[0] != announcementTimeouts[i][0]);
            return;
        }
    }
}

async function processUpcomingStreams(channelID) {
    let holoDat = await bot.getFutureVids(holoAPIKey, channelID, true);
    let holodexData = JSON.parse(holoDat);
    for (let i = 0; i < holodexData.length; i++) {
        let streamProcessed = false;
        for (let j = 0; j < fileCache['streams'].length; j++) {
            if (fileCache['streams'][j].id == holodexData[i].id) {
                streamProcessed = true;
                break;
            }
        }
        if (!streamProcessed) {
            if (holodexData[i].status == "live") {
                console.log("Found stream with status: live");
                let streamerName = "";
                for (let i = 0; i < fileCache['ids'].length; i++) {
                    if (fileCache['ids'][i].id == channelID) {
                        streamerName = fileCache['ids'][i].name;
                    }
                }
                bot.sendMessage(ANNOUNCECHANNEL, (streamerName + " is live!\n\nhttps://youtu.be/" + holodexData[i].id));
            }
            else {
                let timeUntilStream = new Date(holodexData.available_at) - new Date();
                let announceTimeout = setTimeout(function(){announceStream(holodexData[i].id, channelID)}, timeUntilStream);
                console.log("Set timer for announcement, " + timeUntilStream " milliseconds remaining");
                timeoutsActive.push(announceTimeout);
                announcementTimeouts.push([announceTimeout, holodexData[i].id]);
            }
            fileCache['streams'].push(holodexData[i]);
        }
    }
    writeStreams();
}

function livestreamLoop(currentID) {
    console.log("Processing id " + currentID);
    timeoutsActive = timeoutsActive.filter(timeout => timeout != currentLoopTimeout) // Remove currentLoopTimeout from timeoutsActive
    processUpcomingStreams(fileCache['ids'][currentID].id);
    var nextID = (currentID == 54) ? 0 : (currentID + 1);
    currentLoopTimeout = setTimeout(function(){livestreamLoop(nextID)}, 30000);
    timeoutsActive.push(currentLoopTimeout);
}

function startTimedFunctions() {
    intervalsActive.push(setInterval(function() {
        checkForNewTweets("1363705980261855232", FUJI.toString());
    }, 180000));
    currentLoopTimeout = setTimeout(function(){livestreamLoop(48)}, 5000);
    timeoutsActive.push(currentLoopTimeout);
}

startTimedFunctions();
