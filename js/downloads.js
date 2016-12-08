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
function saveAudio(download, $download) {
    if(download.href) {
        var xhr = new XMLHttpRequest();
        chrome.storage.local.get('default_save_dir', function (data) {
            console.log('DATA', data);
            xhr.open("GET", download.href);
            xhr.responseType = "blob";
            console.time('download.finish');
            $download.addClass('downloading');
            xhr.onload = function () {
                var blob = xhr.response;
                console.timeEnd('download.finish');
                console.info(download);
                chrome.storage.local.get('default_save_dir', function (items) {
                    console.log('default_save_dir', items.default_save_dir);
                    chrome.fileSystem.restoreEntry(items.default_save_dir, function (restoredEntry) {
                        console.log('restoredEntry', restoredEntry);
                        chrome.fileSystem.getWritableEntry(restoredEntry, function (writeEntry) {
                            console.log('writeEntry', writeEntry);
                            writeEntry.getFile(download.artist + " - " + download.title + '.mp3', {
                                create: true
                            }, function (fileEntry) {
                                console.log('fileEntry', fileEntry);
                                fileEntry.createWriter(function (writer) {
                                    writer.onwriteend = function (e) {
                                        console.info('file.ready');
                                        e.currentTarget.truncate(e.currentTarget.position);
                                    };
                                    writer.write(blob);
                                });
                            });
                        });
                    });
                });
            };
            xhr.send()
        });
    } else return false;
    // xhr.overrideMimeType("application/octet-stream"); // Or what ever mimeType you want.
}
$(document).ready(function(){
    console.log(vkData, downloads, download);
    var keys = Object.keys(downloads),
        downloadsNum = keys.length;
    if(downloadsNum > 0) {
        $('.downloads-num').text(downloadsNum);
        for(var i = 0; i < downloadsNum; i++) {
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
            '</div>');
            (function(e) {
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
    $('#choose_dir').on('click', function(e) {
        var $that = $(this);
        chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function(theEntry) {
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