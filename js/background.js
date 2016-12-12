var authTabId = null,
    clientID = 5763233,
    redirectUri = 'https://' + chrome.runtime.id + '.chromiumapp.org/provider_cb',
    redirectRe = new RegExp(redirectUri + '[#\?](.*)'),
    storage = {},
    authObj = {
        'url': 'https://oauth.vk.com/authorize?client_id=' + clientID + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=audio&display=page&response_type=token&v=5.60',
        'interactive': true
    },
    downloadQueue = [],
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
    chrome.storage.local.get('downloadQueue', function(data){
        if(data.downloadQueue) downloadQueue = data.downloadQueue;
        if(chrome.runtime.lastError) callback(false, chrome.runtime.lastError);
        else callback(downloadQueue);
    });
}

function downloadRemove(audio, callback) {

}

function downloadPause(audio, callback) {

}

function addAudioToDownloadList(audio, callback) {
    var internalSave = function(audio, callback) {
        downloadQueue.push(audio);
        chrome.storage.local.set({downloadQueue: downloadQueue}, function () {
            if (!chrome.runtime.lastError) callback(downloadQueue);
            else callback(false, chrome.runtime.lastError);
        });
    };
    if(downloadQueue.length == 0) {
        chrome.storage.local.get('downloadQueue', function(data){
            if(data.downloadQueue) downloadQueue = data.downloadQueue;
            internalSave(audio, callback);
        });
    } else {
        internalSave(audio, callback);
    }
}

/**
 * Adding to download queue and start if needed (second argument must be true)
 *
 * @param audio
 * @param start if true, then start download after adding
 * @returns {jQuery.Deferred}
 */
function downloadAdd(audio, start) {
    var answerDef = new $.Deferred();
    if(audio.action) delete audio.action;
    addAudioToDownloadList(audio, function(queue, error){
        var loadingIntoLocal = start === true ? downloadManager.addTask(audio) : downloadManager.addTask(audio, null, false);
        loadingIntoLocal.done(function(answer){
            updateAudioInDownloadList(answer, {
                downloaded: true,
                total: answer.total //adding data after download
            });
            answerDef.resolve(answer);
        });
        loadingIntoLocal.fail(function(error){
            answerDef.reject(error);
        });
    });
    return answerDef;
}

function updateAudioInDownloadList(audio, data, callback) {
    var foundIndex = indexOfDownloadList(audio);
    if(foundIndex !== false) {
        downloadQueue[foundIndex] = $.extend(downloadQueue[foundIndex], data);
        chrome.storage.local.set({downloadQueue: downloadQueue}, function () {
            if (!chrome.runtime.lastError) {
                if(callback) callback(downloadQueue);
            }
            else {
                if(callback) callback(false, chrome.runtime.lastError);
            }
        });
    } else return false;
}

function indexOfDownloadList(data, multi) {
    var id = false,
        foundIndexes = [];
    if(data.audio && data.audio.id) id = data.audio.id;
    if(data.data && data.data.audio && data.data.audio.id) id = data.data.audio.id;
    var foundAudio = $.grep(downloadQueue, function(e, index){
        if(e.id && e.id === id) {
            foundIndexes.push(index);
            return true;
        } else return false;
    });
    if(foundIndexes.length > 0) {
        return multi === true ? foundIndexes : foundIndexes[0];
    } else return false;
}

function setSettings(data, callback, key) {
    if(!key) key = 'vk_user_data';
    if (data && Object.keys(data).length > 0) {
        var obj = {};
        if(key == 'vk_user_data') data = $.extend(data, storage);
        var count = Object.keys(data).length;
        obj[key] = data;
        // console.log('setting SETTING', key, obj, data);
        chrome.storage.sync.set(obj, function () {
            if(key == 'vk_user_data') {
                storage = data;
                if(callback) callback(data);
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
    chrome.app.window.create('auth.html', {
        id: "authorizeWindow",
        innerBounds: {
            minWidth: 670,
            minHeight: 380,
            maxWidth: 800,
            maxHeight: 520
        },
        hidden: true
        // resizable: false
    }, function (appWin) {
        appWin.contentWindow.addEventListener('DOMContentLoaded',
            function(e) {
                var webview = appWin.contentWindow.document.querySelector('webview');
                webview.addEventListener("loadredirect", function(e) {
                    var authData = {};
                    if(e.newUrl.indexOf('access_token') > -1) {
                        var result = e.newUrl.split('#')[1].split('&');
                        authData.access_token = result[0].split('=')[1];
                        authData.expires = result[1].split('=')[1];
                        authData.user_id = result[2].split('=')[1];
                        webview.clearData({
                            since: 0
                        }, {
                            cookies: true
                        }, function(){
                            appWin.close();
                            if(callback) {
                                handleProviderResponse(authData, function(data, error){
                                    callback(data, error);
                                });
                            }
                        });
                    } else {
                        if(callback) callback(null, new Error('Invalid redirect URI'));
                    }
                });
                appWin.show();
            }
        );
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
function launchMain(launchData, vkData, downloadQueue) {
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
        if(downloadQueue) win.contentWindow.downloadQueue = downloadQueue;
    });
}
function logOut() {
    chrome.storage.sync.remove('vk_user_data', function () {
        //default
        var mainWindow = chrome.app.window.get('mainWindow');
        if(mainWindow) mainWindow.close();
        var downloadWindow = chrome.app.window.get('downloadsWindow');
        if(downloadWindow) downloadWindow.close();
        launchWelcome(false, false);
    });
}
function launchDownloadManager(callback, data) {
    initDownloads(function(downloadQueue, error){
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
            if(downloadQueue)  win.contentWindow.downloadQueue = downloadQueue;
            if(callback) callback(downloadQueue, error);
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
            initDownloads(function(downloadQueue, error) {
                launchMain(launchData, vkData, downloadQueue);
            });
        }
    });
});
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    //authorizing
    var action = message.action;
    delete message.action;
    if(action) {
        console.info('chrome.runtime.onMessage.listener', action, message, sender);
        if(action == 'authorize') {
            authorize(function(vkData, error){
                if(error) {
                    sendResponse({error: error});
                } else {
                    initDownloads(function(downloadQueue, error) {
                        console.log('afterinitDownloads', vkData);
                        sendResponse(vkData);
                        chrome.app.window.get('welcomeWindow').close();
                        launchMain(false, vkData, downloadQueue);
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
        } else if(action == 'getAlbumAudios') {
            var count = message.count || 20,
                page = message.page || 0,
                offset = 0,
                album_id = message.album_id || 0;
            if(count > 100) count = 100;
            offset = page * count;
            requestVK('audio.get', {
                need_user: 0,
                count: count,
                offset: offset,
                album_id: album_id
            }, function (answer) {
                answer.page = page;
                answer.num = count;
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
                var downloadDef = downloadAdd(message);
                sendResponse(true);
            });
            return true;
        } else if(action == 'startBulkAudioDownload') {
            launchDownloadManager(function(down, error){
                $.each(message, function(i, audio){
                    var downloadDef = downloadAdd(audio, true);
                    downloadDef.done(function(answer){
                        console.log('finish.BulkAudioDownload', audio, answer);
                        // answer = $.extend(answer, {count: downloadQueue.length});
                        // sendResponse(answer);
                    });
                    downloadDef.fail(function(error){
                        console.error('downloadDef', error);
                        // sendResponse({error: error});
                    });
                });
            });
            return true;
        } else if(action == 'startAudioDownload') {
            launchDownloadManager(function(down, error){
                var downloadDef = downloadAdd(message, true);
                downloadDef.done(function(answer){
                    answer = $.extend(answer, {count: downloadQueue.length});
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
        } else if(action == 'clearAllDownloads') {
            downloadQueue = [];
            chrome.storage.local.set({downloadQueue: downloadQueue}, function () {
                sendResponse({cleared: true});
            });
            return true;
        } else if(action == 'pauseAudioDownload') {
            downloadManager.pause(message);
            sendResponse({paused: true});
            return true;
        } else if(action == 'resumeAudioDownload') {
            downloadManager.resume(message);
            sendResponse({paused: false});
            return true;
        } else if(action == 'changeMaxRunningTasks') {
            console.log('maxRunningTasksChange', message);
            if(message.value) {
                message.value = parseInt(message.value);
                chrome.storage.local.set({maxRunningTasks: message.value}, function () {
                    $(window).trigger('maxRunningTasksChange', message.value);
                    sendResponse({changed: true});
                });
            }
            return true;
        }

    }
});