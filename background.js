var authTabId = null,
    clientID = 5763233,
    redirectUri = 'https://' + chrome.runtime.id + '.chromiumapp.org/provider_cb',
    redirectRe = new RegExp(redirectUri + '[#\?](.*)'),
    storage = {};
function setSettings(data, callback) {
    if (data && Object.keys(data).length > 0) {
        for (property in data) {
            storage[property] = data[property];
        }
        chrome.storage.sync.set({
            'vk_user_data': storage
        }, function () {
            //default
            console.log('data set', storage);
            if (callback) callback(storage);
        });
    } else {
        if (callback) callback(null, true);
    }
}

function getSettings(callback) {
    chrome.storage.sync.get({ 'vk_user_data': {} }, function (data) {
        console.log('get_data', data);
        if(Object.keys(data.vk_user_data).length !== 0) {
            storage = data.vk_user_data;
            if(callback) callback(storage);
        } else {
            callback(null, true);
        }
    });
}

function handleProviderResponse(values) {
    if (values.hasOwnProperty('access_token')) {
        // console.log('setAccessToken', values);
        setSettings(values, function(){
            //settings setting done
        });
    } else if (values.hasOwnProperty('code')) { //if code is used
        //exchangeCodeForToken(values.code);
    } else callback(new Error('Neither access_token nor code available.'));
}

function parseRedirectFragment(fragment) {
    var pairs = fragment.split(/&/);
    var values = {};
    pairs.forEach(function(pair) {
        var nameval = pair.split(/=/);
        values[nameval[0]] = nameval[1];
    });
    return values;
}
function authorize(callback) {
    chrome.identity.launchWebAuthFlow({
        'url': 'https://oauth.vk.com/authorize?client_id=' + clientID + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=audio&display=page&response_type=token&v=5.60',
        'interactive': true
    }, function(redirect_url) {
        // console.log(redirect_url);
        if(chrome.runtime.lastError) {
            if(callback) callback(new Error(chrome.runtime.lastError));
            return;
        } else {
            var matches = redirect_url.match(redirectRe);
            // console.log('redirect_url', redirect_url, matches);
            if (matches && matches.length > 1) {
                handleProviderResponse(parseRedirectFragment(matches[1]));
            } else {
                if(callback) callback(new Error('Invalid redirect URI'));
            }
        }
    });
}

chrome.app.runtime.onLaunched.addListener(function(launchData) {
    getSettings(function(vkData, error) {
        chrome.app.window.create('index.html', {
            id: "welcomeWindow",
            innerBounds: {
                minWidth: 670,
                minHeight: 460,
                maxWidth: 800,
                maxHeight: 480
            }
            // resizable: false
        }, function (win) {
            console.log(chrome.runtime.getURL("img/login.png"));
            win.contentWindow.launchData = launchData;
            win.contentWindow.vkData = vkData;
        });
    });
});
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    //authorizing
    var action = message.action;
    if(action) {
        console.log('message', message, 'sender', sender, 'sendResponse', sendResponse);
        if(action == 'authorize') {
            authorize();
            return true;
        }
    }
});