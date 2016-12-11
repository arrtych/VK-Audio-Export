var downloads = window.downloadQueue || [],
    default_save_dir = false,// {path, fullPath}
    xhrs = {};

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    //authorizing
    var action = message.action;
    delete message.action;
    console.log('chrome.runtime.onMessage.addListener', action, sender, message);
    if (sender.url && sender.url.indexOf('background_page.html') != -1) {
        if (action) {
            if(action == 'runNextTask') {
                var savedAudio = saveAudio(message.data),
                    data = message.data, $download = $;
                console.info('runNextTask');
                if(data.audio) {
                    $download = $('.download-' + data.audio.id).eq(0).addClass('downloading');
                    $progress = $download.find('.progress');
                }

                savedAudio.fail((function($down) {
                    return function(e){
                        console.log('saveAudio.fail', e);
                        sendResponse({
                            error: e
                        });
                    };
                })($download));

                savedAudio.done((function($down) {
                    return function(audioFile){
                        chrome.storage.local.get('downloadQueue', function(data){
                            if(data.downloadQueue) downloads = data.downloadQueue;
                            $('.downloads-num').text(downloads.length);
                        });
                        console.log('saveAudio.done', audioFile);
                        $down.removeClass('downloading').addClass('downloaded');
                        sendResponse(audioFile);
                    };
                })($download));

                savedAudio.progress((function($prog) {
                    return function(percentComplete) {
                        $prog.children().css('width', percentComplete + "%");
                        console.log('messageSending.progress', percentComplete);
                    };
                })($progress));
                return true;
            } else if(action == 'pauseDownloadingTask') {
                var data = message.data,
                    audioID = data.audio && data.audio.id ? data.audio.id : false,
                    xhr = xhrs[audioID];
                if(xhr) {
                    xhr.abort();
                    sendResponse(true);
                } else sendResponse({error: 'XHR not found'});
                return true;
            }
        }
    } else {
        if(action) {
            if(action == "startAudioDownload") {
                prependDownload(message);
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
        if(data && data.default_save_dir) {
            default_save_dir = data.default_save_dir;
            console.log('default_save_dir', default_save_dir);
            $('#choose_dir span').text(default_save_dir.fullPath ? default_save_dir.fullPath : default_save_dir);
        }
        callback();
    });
}
function saveAudio(download) {
    var downloadDef = new $.Deferred();
    if(default_save_dir) {
        if(download.url) {
            var xhr = new XMLHttpRequest(),
                audioID = download.audio.id;
            xhr.open("GET", download.url);
            xhr.responseType = "blob";
            xhr.onprogress = function (event) {
                if (event.lengthComputable) {
                    var percentComplete = Math.round(event.loaded / event.total * 100);
                    return downloadDef.notify(percentComplete);
                }
            };
            xhr.onerror = function(e){
                delete xhrs[audioID];
                downloadDef.reject(e);
            };
            xhr.onload = function (event) {
                var blob = xhr.response;
                delete xhrs[audioID];
                chrome.fileSystem.restoreEntry(default_save_dir.path, function (restoredEntry) {
                    console.log('restoredEntry', restoredEntry);
                    chrome.fileSystem.getWritableEntry(restoredEntry, function (writeEntry) {
                        console.log('writeEntry', writeEntry, download);
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
            xhrs[audioID] = xhr;
            xhr.send();
        } else downloadDef.reject('Empty url parameter');
    } else downloadDef.reject('Empty save directory');
    return downloadDef;
}

function prependDownload(e) {
    var id = e.id;
    if(id) {
        var downloaded = false,
            classes = ['download', 'download-' + id];
        // if(downloads[id] && downloads[id].finished) {
        //     downloaded = true;
        //     classes.push('downloaded');
        // }
        var $download = $('<div class="' + classes.join(" ") + '" data-id="' + e.id + '">' +
            '<div class="middle"><h5><span class="artist">' + e.artist + '</span> - <span class="title" title="' + e.title + '">' + e.title + '</span></h5>' +
            '</div><div class="right"><div class="checkbox">' +
            '<input type="checkbox" value="None" id="checkbox-' + id + '" name="check" />' +
            '<label for="checkbox-' + id + '"></label></div>' +
            '<a href="#" class="start-pause" title="Pause Download"><i class="fa fa-pause-circle" aria-hidden="true"></i></a>' +
            '</div>' +
            '<div class="progress">' +
            '<div class="progress-bar progress-bar-success" style="width: 0"></div>' +
            '</div>' +
            '</div>');
        (function (e) {
            $download.find('.start-pause').on('click', function (event) {
                var $that = $(this);
                saveAudio(e, $that.closest('.download'));
                // sendMessage('startAudioDownload', function (response) {
                //     console.log('startAudioDownload', response, e);
                // }, e);
                // console.log('download', href, artist, title);
                event.preventDefault();
            });
        })(e);
        $('.downloads').prepend($download);
    }
}

$(document).ready(function(){
    initDownloads(function(success, error) {
        var downloadsNum = downloads.length;
        $('.downloads-num').text(downloadsNum);
        // if(default_save_dir)
        if(downloadsNum > 0) {
            for (var i = 0; i < downloadsNum; i++) {
                var e = downloads[i];
                prependDownload(e);
            }
        }
        $('#pause_all').on('click', function (e) {
            var $that = $(this);
            if(!$that.hasClass('paused')) {
                sendMessage('pauseAllDownloads', function (answer) {
                    if (answer.paused) {
                        $that.addClass('paused').find('span').text('Возобновить все');
                    }
                });
            } else {
                sendMessage('resumeAllDownloads', function (answer) {
                    if(!answer.paused) {
                        $that.removeClass('paused').find('span').text('Остановить все');
                    }
                });
            }
        });
        $('#choose_dir').on('click', function (e) {
            var $that = $(this);
            chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function (theEntry) {
                if (!theEntry) {
                    $that.find('span').text('Папка не выбрана');
                    return;
                }
                chrome.fileSystem.getDisplayPath(theEntry, function(displayPath){
                    var saveObject = {
                        path: chrome.fileSystem.retainEntry(theEntry),
                        fullPath: displayPath
                    };
                    chrome.storage.local.set({'default_save_dir': saveObject});
                    default_save_dir = saveObject;
                    $('#choose_dir span').text(displayPath);
                });
            });
        });
    });
});