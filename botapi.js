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

function sendHolodexRequest(func, apiKey, params, callback) {
    let urlQuery = new URLSearchParams(params).toString();
    const options = {
        hostname: 'holodex.net',
        path: '/api/v2/' + func + "?" + urlQuery,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-APIKEY': apiKey
        },
    };
    var req = https.request(options, (resp) => {
        let dataReceived = '';
        resp.on('data', (chunk) => dataReceived += chunk);
        resp.on('end', () => {
            //Call the callback with the data
            callback(dataReceived);
        });
    }).on('error', (err) => {
        console.log("Error sending request: " + err.message);
    });
    req.end();
}

function sendTwitterRequest(func, apiKey, params, callback) {
    let urlQuery = new URLSearchParams(params).toString();
    const options = {
        hostname: 'api.twitter.com',
        path: '/2/' + func + "?" + urlQuery,
        method: 'GET',
        headers: {
            'Authorization': "Bearer " + apiKey
        }
    }
    var req = https.request(options, (resp) => {
        let dataReceived = '';
        resp.on('data', (chunk) => dataReceived += chunk);
        resp.on('end', () => {
            //Call the callback with the data
            callback(dataReceived);
        });
    }).on('error', (err) => {
        console.log("Error sending request: " + err.message);
    });
    req.end();
}

exports.getFutureVids = function(apiKey, channelId, excludeWaitingRooms) {
    if (excludeWaitingRooms) {
        var apiRequest = {
            "channel_id": channelId,
            "max_upcoming_hours": 100
        }
    }
    else {
        var apiRequest = {
            "channel_id": channelId
        }
    }
    return new Promise(function(resolve) {
        sendHolodexRequest("live", apiKey, apiRequest, function(data) {
            resolve(data);
        });
    });
}

exports.getTweets = function(apiKey, twitterId, exclusions) {
    var apiRequest = {
        "max_results": 5
    };
    switch (exclusions) {
        case 1:
            apiRequest.exclude = "retweets";
            break;
        case 2:
            apiRequest.exclude = "replies";
            break;
        case 3:
            apiRequest.exclude = "retweets,replies";
            break;
        default:
            break;
        
    }
    return new Promise(function(resolve) {
        sendTwitterRequest("users/" + twitterId + "/tweets", apiKey, apiRequest, function(data) {
            resolve(data);
        });
    });
}
