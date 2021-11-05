var fs = require('fs');
const DORGE = 440753792;
const FUJI = 532735068;
const DEBUGCHANNEL = -1001397346553;
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
var bootloaderData;
exports.token = null;
exports.name = "HolodexBot";
exports.directory = "";
var intervalsActive = [];

function loadCommands() {
    fileCache['commands'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/commands.json'));
}

function loadIDs() {
    fileCache['ids'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/HoloIDs.json'));
}

exports.init = function(initData) {
    bootloaderData = initData;
    bootloaderData.initBotFunc(exports.directory);
    bot.setToken(exports.token);
    bot.sendMessage(DEBUGCHANNEL, "HolodexBot is ON");
    loadCommands();
    loadIDs();
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
    for (let i = 0; i < fileCache['commands'].length; i++) {
        for (let lineNums = 0; lineNums < message.text.split(`\n`).length; lineNums++) {
            var skipLine = false;
            for (let j = 0; j < fileCache['commands'][i].command_names.length; j++) {
                if (skipLine) {
                    // Only process one command per line
                    break;
                }
                if (message.text.toLowerCase().includes(fileCache['commands'][i].command_names[j])) {
                    processCommand(fileCache['commands'][i], message);
                    skipLine = true;
                    messageProcessed = true;
                }
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
            holodexData = JSON.parse(holoDat);
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
        case 8:
            let twitterData = await bot.getTweets(twitterAPIBearer, fileCache['ids'][command.command_data].twitter_id, 3);
            bot.sendMessage(message.chat.id, twitterData.toString());
            break;
        //Hardcoded commands
        //Help
        case 257:
            shutdown(message);
            break;
        case 260://Refreshes the command list so we don't have to restart the bot
            loadCommands();
            bot.sendReply(message.chat.id, command.command_data.replyText, message.message_id);
            break;
		case 262://Uptime
            doUptime(message);
            break;
        case 263://Clears all intervals
            for (let i = 0; i < intervalsActive.length; i++) {
                clearInterval(intervalsActive[i]);
            }
            bot.sendReply(message.chat_id, "All intervals cleared", message.message_id);
            break;
        default:
            console.error("Somehow there's a command of unknown type");
            break;
    }
}

async function checkForNewTweets(twitterId, chatId) {
    var latestTweet = await bot.getTweets(twitterAPIBearer, twitterId, 3);
    for (let i = 0; i < fileCache['tweets'].length; i++) {
        if (fileCache['tweets'][i]['uid'] == twitterId) {
            if (fileCache['tweets'][i]['tid'] != latestTweet.data[0].id) {
                fileCache['tweets'][i]['tid'] = latestTweet.data[0].id;
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
    return;
}

function startTimedFunctions() {
    intervalsActive.push(setInterval(checkForNewTweets("1363705980261855232", "-1001156677558"), 180000));
}

startTimedFunctions();
