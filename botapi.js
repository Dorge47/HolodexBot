var token = "";
var https = require('https');
exports.setToken = function(botToken) {
    token = botToken;
};

function sendRequest(func, data, callback) {
    var options = {
        hostname: 'api.telegram.org',
        path: '/bot' + token + '/' + func,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    }
    var req = https.request(options, (resp) => {
        let data = '';
        resp.on('data', (chunk) => data += chunk);
        resp.on('end', () => {
            //Call the callback with the data
            callback(data);
        });
    }).on('error', (err) => {
        console.log("Error sending request: " + err.message);
    });
    req.write(JSON.stringify(data));
    req.end();
}

//Sends a message to the given chat id.
exports.sendMessage = function(id, msg) {
    var message = {
        chat_id: id,
        text: msg,
    };
    sendRequest("sendMessage", message, function(text) {
        console.log(text);
    });
}

//Sends a reply to the message of replyId in the chat given by id
exports.sendReply = function(id, msg, replyId) {
    var message = {
        chat_id: id,
        text: msg,
        reply_to_message_id: replyId,
    };
    sendRequest("sendMessage", message, function(text) {
        console.log(text);
    });
}

//Sends (text) linked to (link) to (id) as a reply to (replyId) with previews shown or disabled according to (disableShowPreview)
exports.sendLink = function(id, text, link, replyId, disableShowPreview) {
    var message = {
        chat_id: id,
        text: `[${text}](${link})`,
        parse_mode: "Markdown",
        disable_web_page_preview: disableShowPreview,
        reply_to_message_id: replyId,
    };
    var request = sendRequest("sendMessage", message, function(text) {
        console.log(text);
    });
}

//Sets the webhook to a certain URL.
//Will automatically append the token to the path
exports.setWebhook = function(botUrl) {
    var message = {
        url: botUrl + "/" + token,
    }
    sendRequest("setWebhook", message, function(data) {
        console.log("Set webhook which responded with " + data);
    });
}

// Now we get to the Holodex stuff

function sendHolodexRequest(func, apiKey, data, callback) {
    let fullFunc = func + "?channel_id=" + data.channel_id
    if (data.excludeWaitingRooms) {
        fullFunc += "&max_upcoming_hours=100"
    }
    const options = {
        hostname: 'holodex.net',
        path: '/api/v2' + fullFunc,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-APIKEY': apiKey
        },
    };
    var req = https.request(options, (resp) => {
        let data = '';
        resp.on('data', (chunk) => data += chunk);
        resp.on('end', () => {
            //Call the callback with the data
            callback(data);
        });
    }).on('error', (err) => {
        console.log("Error sending request: " + err.message);
    });
    req.write(JSON.stringify(data));
    req.end();
}

exports.getFutureVids = function(apiKey, channelId, noWaitingRooms) {
    if (noWaitingRooms) {
        var apiRequest = {
            channel_id: channelId,
            excludeWaitingRooms: true
        }
    }
    else {
        var apiRequest = {
            channel_id: channelId,
            excludeWaitingRooms: false
        }
    }
    return new Promise(function(resolve) {
        sendHolodexRequest("/live", apiKey, apiRequest, function(data) {
            var holodexResponse = data;
            resolve(data);
        });
    });
}
