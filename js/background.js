var authTabId = null,
    clientID = 5763233,
    redirectUri = 'https://' + chrome.runtime.id + '.chromiumapp.org/provider_cb',
    redirectRe = new RegExp(redirectUri + '[#\?](.*)'),
    storage = {},
    authObj = {
        'url': 'https://oauth.vk.com/authorize?client_id=' + clientID + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=audio&display=page&response_type=token&v=5.60',
        'interactive': true
    },
    downloads = {},
    downloadManager = new DownloadManager();

function openRequestedPopup(strUrl, strWindowName, sid, method, params) { //todo: must finish with captcha
    chrome.app.window.create(
        'captcha.html',
        {
            innerBounds: {
                minWidth: 270,
                minHeight: 240,
                maxWidth: 320,
                maxHeight: 300
            },
            id: "captchaWindow"
        },
        function(win) {
            win.contentWindow.onload = function() {
                //var webview = win.contentWindow.document.querySelector('#my_webview');
            };
        }
    );
    // if (captchaWindow == null || captchaWindow.closed) {
    //     captchaWindow = window.open("", strWindowName, "resizable=yes,scrollbars=yes,status=no,height=300,width=200");
    //     captchaWindow.document.body.innerHTML = "<form action='https://api.vk.com/method/" + method + "' method='POST'>" + "<img src='" + strUrl + "'>" + "<input type='text' name='captcha_key' placeholder='Enter captcha..'>" + "<input type='hidden' name='captcha_sid' value='" + sid + "'>" + "<input type='hidden' name='access_token' value='" + params.access_token + "'>" + "<input type='hidden' name='text' value='" + params.text + "'>" + "<button type='submit'>Check</button>" + "</form>";
    // } else {
    //     captchaWindow.focus();
    // };
}
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
                    // openRequestedPopup();
                } else {
                    console.info(answer.error.error_msg);
                    if(answer.error.error_code === 14) {
                        openRequestedPopup(answer.error.captcha_img, answer.error.error_msg, answer.error.captcha_sid, method, params);
                    } else if (answer.error.error_code === 5) {
                        logOut();
                    } else {
                        //openRequestedPopup
                        callback(answer);
                    }
                }
            }
        });
        //}
    };
    params.access_token = storage.access_token;
    params.v = "5.8";
    req(method, params, callback);
}

function initDownloads(callback) {
    getSettings(function(downloadsData, error){
        callback(downloadsData, error);
    }, 'downloads');
}

function downloadRemove(audio, callback) {

}

function downloadPause(audio, callback) {

}
function downloadStart(audio) {
    var loadingIntoLocal;
    if(audio.action) delete audio.action;
    console.log('download start', audio);
    loadingIntoLocal = downloadManager.addTask(audio);
    // console.log('downloadStart', audio);
    // loadingIntoLocal.done(function(blob) {
    //     // imgNode.css({
    //     //     backgroundImage: 'url(' + imgBlobUrl + ')'
    //     // });
    //     // return imgNode.html('');
    //     console.log('download done', blob);
    // });
    // loadingIntoLocal.fail(function(error) {
    //     // imgNode.css({
    //     //     backgroundImage: 'url(' + imgBlobUrl + ')'
    //     // });
    //     // return imgNode.html('');
    //     console.error('download fail', error);
    // });
    return loadingIntoLocal;
}

function setSettings(data, callback, key) {
    if(!key) key = 'vk_user_data';
    if (data && Object.keys(data).length > 0) {
        var obj = {};
        if(key == 'vk_user_data') data = $.extend(data, storage);
        else if(key == 'downloads') {
            var audio = {};
            if(data.id) audio[data.id] = data;
            data = $.extend(audio, downloads);
        }
        var count = Object.keys(data).length;
        obj[key] = data;
        // console.log('setting SETTING', key, obj, data);
        chrome.storage.sync.set(obj, function () {
            if(key == 'vk_user_data') {
                storage = data;
                if(callback) callback(data);
            } else if(key == 'downloads') {
                downloads = data;
                if(callback) callback(data, false, count);
            }
        });
    } else {
        if (callback) callback(null, new Error('Empty input data'));
    }
}

function getSettings(callback, key) {
    if(!key) key = 'vk_user_data';
    var obj = {};
    obj[key] = {};
    chrome.storage.sync.get(obj, function (data) {
        console.log('get_data', key, data);
        if(data[key] && Object.keys(data[key]).length !== 0) {
            if(key == 'vk_user_data') storage = data[key];
            else if(key == 'downloads') downloads = data[key];
            if(callback) callback(data[key]);
        } else {
            callback(null, new Error('Empty ' + key));
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
function launchMain(launchData, vkData, downloads) {
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
        if(downloads) win.contentWindow.downloads = downloads;
    });
}
function logOut() {
    chrome.identity.removeCachedAuthToken({token: storage.access_token}, function(){
        chrome.storage.sync.remove('vk_user_data', function () {
            //default
            var mainWindow = chrome.app.window.get('mainWindow');
            if(mainWindow) mainWindow.close();
            launchWelcome(false, false);
        });
    });
}
function launchDownloadManager(callback, data) {
    initDownloads(function(downloads, error){
        chrome.app.window.create('downloads.html', {
            id: "downloadsWindow",
            innerBounds: {
                minWidth: 480,
                minHeight: 640
            },
            showInShelf: true,
            resizable: true
        }, function (win) {
            if(data) win.contentWindow.launchData = data;
            if(downloads)  win.contentWindow.downloads = downloads;
            if(callback) callback(downloads, error);
        });
    });
}
chrome.app.runtime.onLaunched.addListener(function(launchData) {
    //must init all options and settings
    getSettings(function(vkData, error) {
        console.log(vkData, error);
        if(error) {//not logged in
            launchWelcome(launchData, vkData);
        } else {
            initDownloads(function(downloadsData, error) {
                launchMain(launchData, vkData, downloadsData);
            });
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
                    initDownloads(function(downloadsData) {
                        sendResponse(vkData);
                        chrome.app.window.get('welcomeWindow').close();
                        launchMain(false, vkData);
                    });
                }
            });
            return true;
        } else if(action == 'logout') {
            console.log('logout', storage);
            logOut();
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
            launchDownloadManager(function(downloads, error){
                sendResponse(true);
            });
            return true;
        } else if(action == 'addAudioDownload') {
            launchDownloadManager(function(downloads, error){
                downloadStart(message);
            });
            return true;
        } else if(action == 'startAudioDownload') {
            launchDownloadManager(function(downloads, error){
                var downloadDef = downloadStart(message);
                downloadDef.done(function(answer){
                    sendResponse(answer);
                });
                downloadDef.fail(function(error){
                    console.error('downloadDef', error);
                    sendResponse({error: error});
                });
            });
            return true;
        } else if(action == 'pauseAllDownloads') {
            sendResponse({
                array: downloadManager.pauseAll(),
                paused: downloadManager.paused
            });
            return true;
        } else if(action == 'resumeAllDownloads') {
            sendResponse({
                array: downloadManager.resumeAll(),
                paused: downloadManager.paused
            });
            return true;
        }

    }
});