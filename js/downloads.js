var downloads = window.downloads || {},
    default_save_dir = false;
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
function saveAudio(download, $download, callback) {
    if(default_save_dir) {
        if(download.href) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", download.href);
            xhr.responseType = "blob";
            console.time('download.finish');
            $download.addClass('downloading');
            var $progress = $download.find('.progress');
            $progress.removeClass('hide');
            xhr.onprogress = function (event) {
                if (event.lengthComputable) {  //event.loaded the bytes browser receive
                    //evt.total the total bytes seted by the header
                    //
                    var percentComplete = (event.loaded / event.total) * 100;
                    console.log(percentComplete);
                    $progress.children().width(percentComplete + "%");
                    // $('#progressbar').progressbar( "option", "value", percentComplete );
                }
            };
            xhr.onload = function (event) {
                var blob = xhr.response;
                console.timeEnd('download.finish');
                console.info(download);
                chrome.fileSystem.restoreEntry(default_save_dir, function (restoredEntry) {
                    console.log('restoredEntry', restoredEntry);
                    chrome.fileSystem.getWritableEntry(restoredEntry, function (writeEntry) {
                        console.log('writeEntry', writeEntry);
                        writeEntry.getFile(download.artist + " - " + download.title + '.mp3', {
                            create: true
                        }, function (fileEntry) {
                            console.log('fileEntry', fileEntry);
                            fileEntry.createWriter(function (writer) {
                                console.log('writer', writer);
                                writer.onabort = function (e) {
                                    console.error('writer onabort', e);
                                    callback(false, e);
                                };
                                writer.onerror = function (e) {
                                    console.error('writer error', e);
                                    callback(false, e);
                                };
                                writer.onwriteend = function (e) {
                                    console.info('file.ready');
                                    $progress.addClass('hide');
                                    callback(true);
                                    // e.currentTarget.truncate(e.currentTarget.position);
                                };
                                writer.write(blob);
                            });
                        });
                    });
                });
            };
            xhr.send();
        }
    } else callback(false, new Error('Empty save directory'));
}
$(document).ready(function(){
    initDownloads(function(success, error) {
        console.log(vkData, downloads, download);
        var keys = Object.keys(downloads),
            downloadsNum = keys.length;
        $('.downloads-num').text(downloadsNum);
        if(default_save_dir)
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
                        saveAudio(e, $download);
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