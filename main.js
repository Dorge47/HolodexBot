var fs = require('fs');
const DORGE = "440753792";
const FUJI = "532735068";
const DEBUGCHANNEL = "-1001397346553";
const ANNOUNCECHANNEL = "-1001239173779";
const SGN = "-1001156677558";
const admins = [DORGE];
const holoAPIKey = JSON.parse(fs.readFileSync("/home/pi/Hololive/apikey"));
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
fileCache['streams'] = [];
fileCache['birthdays'] = [];
var bootloaderData;
exports.token = null;
exports.name = "HolodexBot";
exports.directory = "";
var intervalsActive = [];
var timeoutsActive = [];
var birthdaysPending = [];
var currentLoopTimeout;
var currentBirthdayTimeout;
var announcementTimeouts = [];
var initLoop = true;

function loadFileCache() {
    fileCache['commands'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/commands.json'));
    fileCache['ids'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/HoloIDs.json'));
    fileCache['streams'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/streams.json'));
    fileCache['birthdays'] = JSON.parse(fs.readFileSync("./" + exports.directory + '/birthdays.json'));
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
    setTimeout(function() {
        for (let i = fileCache['streams'].length - 1; i >= 0; i--) {
            let timeUntilStream = new Date(fileCache['streams'][i].available_at) - new Date();
            if (timeUntilStream > 0) {
                let announceTimeout = setTimeout(announceStream, timeUntilStream, fileCache['streams'][i].id, fileCache['streams'][i].channel.id);
                let debugMsg = "Set timer for announcement of " + fileCache['streams'][i].id + ", " + timeUntilStream + " milliseconds remaining";
                console.log(debugMsg);
                timeoutsActive.push(announceTimeout);
                announcementTimeouts.push([announceTimeout, fileCache['streams'][i].id]);
            }
            else {
                fileCache['streams'].splice(i,1);
            }
        }
    }, 5000);
    setTimeout(function() {
        for (let i = 0; i < fileCache['birthdays'].length; i++) {
            setBirthday(fileCache['birthdays'][i]);
        };
    }, 5000);
    writeStreams();
}

function forHolodexBot(msg,removeIdentifier) {
    for (let i = 0; i < identifiers.length; i++) {
        if (msg.text.toLowerCase().includes(identifiers[i])) {
            if (msg.text.toLowerCase().indexOf(identifiers[i]) == 0) {
                if (removeIdentifier) {
                    return msg.text.toLowerCase().slice(identifiers[i].length + 1);
                }
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
    if (!forHolodexBot(message,false)) {
        // Check for pekofy
        pekofy(message);
        return;
    }
    // Check to see if any of the messages match a command
    let messageProcessed = false;
    for (let i = 0; i < fileCache['commands'].length; i++) {
        if (messageProcessed) {
            break;
        }
        for (let j = 0; j < fileCache['commands'][i].command_names.length; j++) {
            if (forHolodexBot(message,true) == fileCache['commands'][i].command_names[j]) {
                processCommand(fileCache['commands'][i], message);
                messageProcessed = true;
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
    for (let i = intervalsActive.length - 1; i >= 0; i--) {
        clearInterval(intervalsActive[i]);
    }
    for (let i = timeoutsActive.length - 1; i >= 0 ; i--) {
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
                setTimeout(bot.sendReply, 300, message.chat.id, ("https://youtu.be/" + holodexData[0].id), message.message_id);
            }
            else {
                // Delay and list current livestreams
                setTimeout(bot.sendReply, 300, message.chat.id, ("https://youtu.be/" + holodexData[livestreamIndex].id), message.message_id);
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
        case 264:
            let tempArr = fileCache['streams'];
            for (let i = tempArr.length - 1; i >= 0; i--) {
                let timeUntilStream = new Date(tempArr[i].available_at) - new Date();
                if (timeUntilStream < 0) {
                    tempArr.splice(i,1);
                }
            }
            fileCache['streams'] = tempArr;
            writeStreams();
            bot.sendReply(message.chat.id, "Stream array pruned", message.message_id);
            break;
        default:
            console.error("Somehow there's a command of unknown type");
            break;
    }
}

function clearTimeoutsManually(identifier, method) {
    switch (method) {
        case "streamID":
            for (let i = announcementTimeouts.length - 1; i >= 0; i--) {
                if (announcementTimeouts[i][1] == identifier) {
                    clearTimeout(announcementTimeouts[i][0]);
                    timeoutsActive = timeoutsActive.filter(timeout => timeout != announcementTimeouts[i][0]);
                    announcementTimeouts.splice(i,1);
                }
            }
            break;
        default:
            console.error("clearTimeoutsManually() called with unknown method: " + method);
            break;
    }
    console.log("Timeout with " + method + ": " + identifier + " cleared successfully");
}

function getNameFromChannelID(channelID) {
    for (let i = 0; i < fileCache['ids'].length; i++) {
        if (fileCache['ids'][i].id == channelID) {
            return fileCache['ids'][i].name;
        }
    }
    console.error("fileCache['ids'] contains no entry with id: " + channelID);
}

async function announceStream(streamId, channelId) {
    let streamDat = await bot.getVideoById(holoAPIKey, streamId);
    let streamData = JSON.parse(streamDat)[0];
    if (typeof(streamData.id) == "undefined") {
        console.error("StreamId: " + streamId + ", channelId: " + channelId + ", raw JSON: " + JSON.stringify(streamData));
        process.exit();
    }
    let cacheIndex;
    let cacheData;
    let streamerName = getNameFromChannelID(channelId);
    for (let i = 0; i < fileCache['streams'].length; i++) {
        if (fileCache['streams'][i].id == streamId) {
            cacheIndex = i;
            cacheData = fileCache['streams'][i];
            break;
        }
    }
    if (streamData.status == "missing") {
        console.error(streamerName + " cancelled stream with ID: " + streamId + ", skipping announcement");
    }
    else {
        if (streamData.available_at != cacheData.available_at) { // Stream has already started or been rescheduled
            let timeUntilStream = new Date(streamData.available_at) - new Date();
            if (timeUntilStream < -300000) { // Stream has already started over five minutes ago
                console.error("Stream with ID: " + streamData.id + " started " + (timeUntilStream * -1) + " milliseconds ago, skipping announcement");
            }
            else if (timeUntilStream > 60000) { // Stream has been rescheduled for at least a minute from now
                clearTimeoutsManually(streamData.id, "streamID");
                let announceTimeout = setTimeout(announceStream, timeUntilStream, streamData.id, channelId);
                let debugMsg = "Rectified timer for announcement of " + streamData.id + ", " + timeUntilStream + " milliseconds remaining";
                console.log(debugMsg);
                timeoutsActive.push(announceTimeout);
                announcementTimeouts.push([announceTimeout, streamData.id]);
                fileCache['streams'][cacheIndex] = streamData;
                return;
            }
            else if (streamData.status == "live") { // Stream start time has changed, but is live now
                bot.sendMessage(ANNOUNCECHANNEL, (streamerName + " is live!\n\nhttps://youtu.be/" + streamId));
            }
            else { // Recheck for live in 20 seconds
                clearTimeoutsManually(streamData.id, "streamID");
                let announceTimeout = setTimeout(announceStream, 20000, streamData.id, channelId);
                let debugMsg = "Delaying announcement of " + streamData.id + " for 20 seconds";
                console.log(debugMsg);
                timeoutsActive.push(announceTimeout);
                announcementTimeouts.push([announceTimeout, streamData.id]);
                fileCache['streams'][cacheIndex] = streamData;
                return;
            }
        }
        else if (streamData.status == "live") { // Stream start time unchanged and live
            bot.sendMessage(ANNOUNCECHANNEL, (streamerName + " is live!\n\nhttps://youtu.be/" + streamId));
        }
        else { // Recheck for live in 20 seconds
            clearTimeoutsManually(streamData.id, "streamID");
            let announceTimeout = setTimeout(announceStream, 20000, streamData.id, channelId);
            let debugMsg = "Delaying announcement of " + streamData.id + " for 20 seconds";
            console.log(debugMsg);
            timeoutsActive.push(announceTimeout);
            announcementTimeouts.push([announceTimeout, streamData.id]);
            fileCache['streams'][cacheIndex] = streamData;
            return;
        }
    }
    clearTimeoutsManually(streamId, "streamID");
    fileCache['streams'].splice(cacheIndex, 1);
    /* This is where we would typically call writeStreams(), but it's not
    uncommon for multiple streams to be announced at the exact same time, so we
    have to leave the streams.json file out of date. Invoking the prune function
    is a way to manually update the file */
}

async function processUpcomingStreams(channelID) {
    let holoDat = await bot.getFutureVids(holoAPIKey, channelID, true);
    let holodexData = JSON.parse(holoDat);
    for (let i = 0; i < holodexData.length; i++) {
        if (holodexData[i].status == "live") {
            continue;
        }
        let streamProcessed = false;
        for (let j = fileCache['streams'].length - 1; j >= 0; j--) {
            if (fileCache['streams'][j].id == holodexData[i].id) {
                streamProcessed = true;
                if (fileCache['streams'][j].available_at != holodexData[i].available_at) {
                    clearTimeoutsManually(holodexData[i].id, "streamID");
                    let timeUntilStream = new Date(holodexData[i].available_at) - new Date();
                    if (timeUntilStream < 0) {
                        console.error("Stream with ID: " + holodexData[i].id + " already started, skipping announcement");
                        fileCache['streams'].splice(j,1);
                    }
                    else {
                        let announceTimeout = setTimeout(announceStream, timeUntilStream, holodexData[i].id, channelID);
                        let debugMsg = "Rectified timer for announcement of " + holodexData[i].id + ", " + timeUntilStream + " milliseconds remaining";
                        console.log(debugMsg);
                        timeoutsActive.push(announceTimeout);
                        announcementTimeouts.push([announceTimeout, holodexData[i].id]);
                        fileCache['streams'][j] = holodexData[i];
                    }
                }
                break;
            }
        }
        if (!streamProcessed) {
            let timeUntilStream = new Date(holodexData[i].available_at) - new Date();
            let announceTimeout = setTimeout(announceStream, timeUntilStream, holodexData[i].id, channelID);
            let debugMsg = "Set timer for announcement of " + holodexData[i].id + ", " + timeUntilStream + " milliseconds remaining";
            console.log(debugMsg);
            timeoutsActive.push(announceTimeout);
            announcementTimeouts.push([announceTimeout, holodexData[i].id]);
            fileCache['streams'].push(holodexData[i]);
        }
    }
    writeStreams();
}

function livestreamLoop(currentID) {
    timeoutsActive = timeoutsActive.filter(timeout => timeout != currentLoopTimeout) // Remove currentLoopTimeout from timeoutsActive
    processUpcomingStreams(fileCache['ids'][currentID].id);
    var nextID = (currentID == 56) ? 0 : (currentID + 1);
    if (initLoop && !nextID) {
        initLoop = false;
    }
    currentLoopTimeout = setTimeout(livestreamLoop, initLoop ? 10000 : 30000, nextID);
    timeoutsActive.push(currentLoopTimeout);
}

function birthdayLoop() {
    timeoutsActive = timeoutsActive.filter(timeout => timeout != currentBirthdayTimeout)
    for (let i = 0; i < fileCache['birthdays'].length; i++) {
        setBirthday(fileCache['birthdays'][i]);
    };
    currentBirthdayTimeout = setTimeout(birthdayLoop, 2000000000);
    timeoutsActive.push(currentBirthdayTimeout);
}

function startTimedFunctions() {
    currentLoopTimeout = setTimeout(livestreamLoop, 15000, 0);
    timeoutsActive.push(currentLoopTimeout);
    currentBirthdayTimeout = setTimeout(birthdayLoop, 2000000000);
    timeoutsActive.push(currentBirthdayTimeout);
}

function announceBirthday(name, birthday) {
    for (let i = 0; i < birthdaysPending.length; i++) {
        if (birthdaysPending[i].name == birthday.name) {
            birthdaysPending.splice(i,1);
            console.log("Cleared " + name + "'s birthday for announcement");
        };
    };
    bot.sendMessage(SGN, "It's " + name + "'s birthday!");
    bot.sendMessage(SGN, "🥳");
}

function setBirthday(birthday) {
    for (let i = 0; i < birthdaysPending.length; i++) {
        if (birthdaysPending[i].name == birthday.name) {
            console.log("Birthday for " + birthday.name + " already found, skipping attempt to setBirthday");
            return;
        };
    };
    let currentYear = new Date().getFullYear();
    let comparisonDate = new Date(birthday.month + " " + birthday.date + " " + currentYear);
    let offset = comparisonDate.getTimezoneOffset();
    switch (birthday.region) {
        case "en":
            break;
        case "jp":
            comparisonDate = new Date(comparisonDate - 0 - (offset+540)*60000);
        case "id":
            comparisonDate = new Date(comparisonDate - 0 - (offset+420)*60000);
        default:
            break;
    };
    if ((comparisonDate - new Date()) < 0) {
        currentYear++;
    };
    let timeUntilBirthday = new Date(birthday.month + " " + birthday.date + " " + currentYear) - new Date();
    switch (birthday.region) {
        case "en":
            break;
        case "jp":
            timeUntilBirthday = new Date(timeUntilBirthday - 0 - (offset+540)*60000);
        case "id":
            timeUntilBirthday = new Date(timeUntilBirthday - 0 - (offset+420)*60000);
        default:
            break;
    };
    if (timeUntilBirthday > 2147483647) {
        return;
    };
    birthdaysPending.push(birthday);
    timeoutsActive.push(setTimeout(announceBirthday, timeUntilBirthday, birthday.name, birthday));
    console.log("Set timer for " + birthday.name + "'s birthday, " + timeUntilBirthday + " milliseconds remaining");
}

startTimedFunctions();
