var authTabId = null,
    clientID = 5763233,
    redirectUri = 'https://' + chrome.runtime.id + '.chromiumapp.org/provider_cb',
    redirectRe = new RegExp(redirectUri + '[#\?](.*)'),
    storage = {},
    authObj = {
        'url': 'https://oauth.vk.com/authorize?client_id=' + clientID + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=audio&display=page&response_type=token&v=5.60',
        'interactive': true
    };
function requestVK(method, params, callback) {
    var req = function (method, params, callback) {
        //if(captchaWindow) {
        $.ajax({
            method: "POST",
            url: "https://api.vk.com/method/" + method,
            data: params,
            success: function (answer) {
                if (!answer.error) {
                    if (!answer.response) callback(answer);
                    else callback(answer.response);
                } else {
                    if(answer.error.error_code === 14) openRequestedPopup(answer.error.captcha_img, answer.error.error_msg, answer.error.captcha_sid, method, params);else if (answer.error.error_code === 5) authorize();else callback(answer);
                }
            }
        });
        //}
    };
    params.access_token = storage.access_token;
    params.v = "5.8";
    req(method, params, callback);
}

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
        if (callback) callback(null, new Error('Empty input data'));
    }
}

function getSettings(callback) {
    chrome.storage.sync.get({ 'vk_user_data': {} }, function (data) {
        console.log('get_data', data);
        if(Object.keys(data.vk_user_data).length !== 0) {
            storage = data.vk_user_data;
            if(callback) callback(storage);
        } else {
            callback(null, new Error('Empty vk_user_data'));
        }
    });
}

function handleProviderResponse(values, callback) {
    if (values.hasOwnProperty('access_token')) {
        // console.log('setAccessToken', values);
        setSettings(values, function(data, error){
            //settings setting done
            if(callback) {
                callback(data, error);
            }
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
    chrome.identity.launchWebAuthFlow(authObj, function(redirect_url) {
        // console.log(redirect_url);
        if(chrome.runtime.lastError) {
            if(callback) callback(null, new Error(chrome.runtime.lastError));
        } else {
            var matches = redirect_url.match(redirectRe);
            // console.log('redirect_url', redirect_url, matches);
            if (matches && matches.length > 1) {
                if(callback) {
                    handleProviderResponse(parseRedirectFragment(matches[1]), function(data, error){
                        callback(data, error);
                    });
                }
            } else {
                if(callback) callback(null, new Error('Invalid redirect URI'));
            }
        }
        return;
    });
}
function launchWelcome(launchData, vkData) {
    chrome.app.window.create('welcome.html', {
        id: "welcomeWindow",
        innerBounds: {
            minWidth: 670,
            minHeight: 500,
            maxWidth: 800,
            maxHeight: 520
        }
        // resizable: false
    }, function (win) {
        win.contentWindow.launchData = launchData;
    });
}
function launchMain(launchData, vkData) {
    chrome.app.window.create('index.html', {
        id: "mainWindow",
        innerBounds: {
            minWidth: 800,
            minHeight: 720
        },
        resizable: true
    }, function (win) {
        win.contentWindow.launchData = launchData;
        win.contentWindow.vkData = vkData;
    });
}
function launchDownloadManager(launchData, vkData, downloads) {
    chrome.app.window.create('downloads.html', {
        id: "downloadsWindow",
        innerBounds: {
            minWidth: 480,
            minHeight: 640
        },
        showInShelf: true,
        resizable: true
    }, function (win) {
        win.contentWindow.launchData = launchData;
        win.contentWindow.vkData = vkData;
        if(downloads) win.contentWindow.downloads = downloads;
    });
}
chrome.app.runtime.onLaunched.addListener(function(launchData) {
    getSettings(function(vkData, error) {
        console.log(vkData, error);
        if(error) {//not logged in
            launchWelcome(launchData, vkData);
        } else {
            launchMain(launchData, vkData);
        }
    });
});
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    //authorizing
    var action = message.action;
    if(action) {
        console.log('message', message, 'sender', sender, 'sendResponse', sendResponse);
        if(action == 'authorize') {
            authorize(function(vkData, error){
                if(error) {
                    sendResponse({error: error});
                } else {
                    sendResponse(vkData);
                    chrome.app.window.get('welcomeWindow').close();
                    launchMain(false, vkData);
                }
            });
            return true;
        } else if(action == 'logout') {
            console.log('logout', storage);
            chrome.identity.removeCachedAuthToken({token: storage.access_token}, function(){
                chrome.storage.sync.remove('vk_user_data', function () {
                //default
                    chrome.app.window.get('mainWindow').close();
                    launchWelcome(false, false);
                });
            });
            return true;
        } else if(action == 'getMyInfo') {
            requestVK('users.get', {
                fields: 'photo_50,online,status,last_seen'
            }, function (answer) {
                if(answer.length > 0) sendResponse(answer[0]);
                else sendResponse(null);
            });
            return true;
        } else if(action == 'getAlbums') {
            requestVK('audio.getAlbums', {
                count: 100
            }, function (answer) {
                sendResponse(answer);
            });
            return true;
        } else if(action == 'getAudios') {
            var count = message.count || 20,
                page = message.page || 0,
                offset = 0;
            if(count > 100) count = 100;
            offset = page * count;
            requestVK('audio.get', {
                need_user: 0,
                count: count,
                offset: offset
            }, function (answer) {
                answer.page = page;
                answer.num = count;
                sendResponse(answer);
            });
            return true;
        } else if(action == 'openDownloadManager') {
            sendResponse({});
            launchDownloadManager(false, false, {});
            return true;
        }

    }
});