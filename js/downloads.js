var downloads = window.downloads || {},
    default_save_dir = false;

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    //authorizing
    var action = message.action;
    console.log('chrome.runtime.onMessage.addListener', action, sender, message);
    if (sender.url && sender.url.indexOf('background_page.html') != -1) {
        if (action) {
            if(action == 'runNextTask') {
                var savedAudio = saveAudio(message.data);
                savedAudio.fail(function(e){
                    console.log('saveAudio.fail', e);
                    sendResponse({
                        error: e
                    });
                });
                savedAudio.done(function(audioFile){
                    console.log('saveAudio.done', audioFile);
                    sendResponse(audioFile);
                });
                savedAudio.progress(function(percentComplete) {
                    console.log('messageSending.progress', percentComplete);
                });
                return true;
            }
        }
    }
});


function sendMessage(action, callback, data) {
    if(action) {
        var msg = {
            action: action
        };
        if(data) {
            for(property in data) {
                msg[property] = data[property];
            }
        }
        chrome.runtime.sendMessage(msg, function(response){
            if(callback) callback(response);
            console.log('action', action, 'response', response);
            if(chrome.runtime.lastError) console.error('action', action, chrome.runtime.lastError);
        });
    }
}
function initDownloads(callback) {
    chrome.storage.local.get('default_save_dir', function (data) {
        if(data && data.default_save_dir) default_save_dir = data.default_save_dir;
        callback();
    });
}
function saveAudio(download) {
    var downloadDef = new $.Deferred();
    if(default_save_dir) {
        if(download.url) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", download.url);
            xhr.responseType = "blob";
            xhr.onprogress = function (event) {
                if (event.lengthComputable) {
                    var percentComplete = Math.round(event.loaded / event.total * 100);
                    return downloadDef.notify(percentComplete);
                }
            };
            xhr.onerror = function(e){
                downloadDef.reject(e);
            };
            xhr.onload = function (event) {
                var blob = xhr.response;
                chrome.fileSystem.restoreEntry(default_save_dir, function (restoredEntry) {
                    console.log('restoredEntry', restoredEntry);
                    chrome.fileSystem.getWritableEntry(restoredEntry, function (writeEntry) {
                        console.log('writeEntry', writeEntry);
                        var artist = download.audio &&  download.audio.artist ? download.audio.artist : 'VA Artist',
                            title = download.audio && download.audio.title ? download.audio.title : 'Unnamed';
                        writeEntry.getFile(artist + " - " + title + '.mp3', {
                            create: true
                        }, function (fileEntry) {
                            console.log('fileEntry', fileEntry);
                            fileEntry.createWriter(function (writer) {
                                console.log('writer', writer);
                                writer.onabort = function (e) {
                                    console.error('writer onabort', e);
                                    downloadDef.reject(e);
                                };
                                writer.onerror = function (e) {
                                    console.error('writer error', e);
                                    downloadDef.reject(e);
                                };
                                writer.onwriteend = function (e) {
                                    console.info('file.ready');
                                    downloadDef.resolve({
                                        name: fileEntry.name,
                                        data: download,
                                        fullPath: fileEntry.fullPath
                                    });
                                    // e.currentTarget.truncate(e.currentTarget.position);
                                };
                                writer.write(blob);
                            });
                        });
                    });
                });
            };
            xhr.send();
        } else downloadDef.reject('Empty url parameter');
    } else downloadDef.reject('Empty save directory');
    return downloadDef;
}
$(document).ready(function(){
    initDownloads(function(success, error) {
        var keys = Object.keys(downloads),
            downloadsNum = keys.length;
        $('.downloads-num').text(downloadsNum);
        // if(default_save_dir)
        if(downloadsNum > 0) {
            for (var i = 0; i < downloadsNum; i++) {
                var key = keys[i],
                    e = downloads[key],
                    id = e.owner_id + "_" + e.id;
                var $download = $('<div class="download" data-id="' + e.id + '">' +
                    '<div class="middle"><h5><span class="artist">' + e.artist + '</span> - <span class="title" title="' + e.title + '">' + e.title + '</span></h5>' +
                    '</div><div class="right"><div class="checkbox">' +
                    '<input type="checkbox" value="None" id="checkbox-' + id + '" name="check" />' +
                    '<label for="checkbox-' + id + '"></label></div>' +
                    '<a href="' + e.url + '" class="start-pause" title="Pause Download"><i class="fa fa-download" aria-hidden="true"></i></a>' +
                    '</div>' +
                    '<div class="progress hide">' +
                    '<div class="progress-bar progress-bar-success" style="width: 0"></div>' +
                    '</div>' +
                    '</div>');
                (function (e) {
                    $download.find('.start-pause').on('click', function (event) {
                        var $that = $(this);
                        console.log('startAudioDownload', event, e);
                        saveAudio(e, $that.closest('.download'));
                        // sendMessage('startAudioDownload', function (response) {
                        //     console.log('startAudioDownload', response, e);
                        // }, e);
                        // console.log('download', href, artist, title);
                        event.preventDefault();
                    });
                })(e);
                $('.downloads').append($download);
            }
        }
        $('#choose_dir').on('click', function (e) {
            var $that = $(this);
            chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function (theEntry) {
                if (!theEntry) {
                    $that.find('span').text('Папка не выбрана');
                    return;
                }
                // use local storage to retain access to this file
                chrome.storage.local.set({'default_save_dir': chrome.fileSystem.retainEntry(theEntry)});
                if (theEntry.isDirectory) {
                    console.log(theEntry);
                }
            });
        });
    });
});