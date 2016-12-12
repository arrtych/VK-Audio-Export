var lastContentSendMessage = null,
    service, tracker,
    downloads = window.downloadQueue || [],
    vkData = window.vkData || {},
    userLabel = 'User-' + vkData.user_id,
    selectedAudios = [];

service = analytics.getService('vk_audio_export');
// service.getConfig().addCallback(initAnalyticsConfig);
// Get a Tracker using your Google Analytics app Tracking ID.
tracker = service.getTracker('UA-88814053-1');
tracker.sendAppView('mainWindow');

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
};

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
        if(action == 'getAudios' || action == 'getAlbumAudios') lastContentSendMessage = msg;
        chrome.runtime.sendMessage(msg, function(response){
            if(callback) callback(response);
            console.log('action', action, 'response', response);
            if(chrome.runtime.lastError) console.error('action', action, chrome.runtime.lastError);
        });
    }
}
function bulkDownload() {

}
function checkButton() {
    selectedAudios = [];
    $('.audios .audio').each(function(i, e){
        var $audio = $(this),
            checked = $audio.find('.checkbox input').prop('checked');
        if(checked) {
            var $that = $(this),
                url = $that.find('.download').attr('href'),
                artist = $that.find('.artist').text(),
                title = $that.find('.title').text(),
                audio_id = $that.data('audio-id'),
                owner_id = $that.data('owner-id'),
                id = owner_id + "_" + audio_id;
            selectedAudios.push({
                id: id,
                url: url,
                title: title,
                artist: artist
            });
        }
    });
    console.log('selected', selectedAudios);
    if(selectedAudios.length > 0) {
        $('.bulk-download').removeClass('hide');
    } else {
        $('.bulk-download').addClass('hide');
    }
}
function getAudios(params, callback, method) {
    var $loader = $('.header .loading');
    $loader.show();
    if(!method) method = 'getAudios';
    sendMessage(method, function(response){
        if(response.items) {
            $('.audios').empty();
            for(var i = 0; i < response.items.length; i++) {
                var e = response.items[i],
                    id = e.owner_id + "_" + e.id,
                    downloaded = false,
                    classes = ['audio', 'audio-' + id];
                var foundAudio = $.grep(downloads, function(e){
                    return e.id && e.id === id;
                });
                if(foundAudio.length > 0 && foundAudio[0].downloaded) {
                    downloaded = true;
                    classes.push('downloaded');
                }
                var $audio = $('<div class="' + classes.join(" ") + '" data-owner-id="' + e.owner_id + '" data-audio-id="' + e.id + '"><div class="left">' +
                    '<a href="#"><i class="fa fa-play-circle fa-2x" aria-hidden="true"></i></a></div>' +
                    '<div class="middle"><h5><span class="artist">' + e.artist + '</span> - <span class="title" title="' + e.title + '">' + e.title + '</span></h5>' +
                    '</div><div class="right"><div class="checkbox">' +
                    '<input type="checkbox" value="None" id="checkbox-' + id + '" name="check" />' +
                    '<label for="checkbox-' + id + '"></label></div>' +
                    '<a href="' + e.url + '" class="download" title="Download Audio"><i class="fa fa-download" aria-hidden="true"></i></a>' +
                    '<span class="duration" data-duration="' + e.duration + '">' + (e.duration + "").toHHMMSS() + '</span>' +
                    '</div>' +
                    '</div>');
                if(!downloaded) {
                    $audio.find('.download').on('click', function (e) {
                        var $that = $(this),
                            $parent = $that.parent().parent(),
                            url = $that.attr('href'),
                            artist = $parent.find('.artist').text(),
                            title = $parent.find('.title').text(),
                            audio_id = $parent.data('audio-id'),
                            owner_id = $parent.data('owner-id'),
                            id = owner_id + "_" + audio_id;
                        $('.audio-' + id).addClass('downloading');
                        sendMessage('startAudioDownload', function (response) {
                            if (response && !response.error) {
                                if (response.count) $('.downloads-count').text(response.count);
                                if (response.data) {
                                    var data = response.data;
                                    if (data.audio && data.audio.id) {
                                        $('.audio-' + data.audio.id).removeClass('downloading').addClass('downloaded');
                                        $that.attr('title', 'Audio downloaded');
                                        $that.off('click');
                                        $that.on('click', function (e) {
                                            e.preventDefault();
                                        });
                                    }
                                }
                                tracker.sendEvent(userLabel, 'download.finish', JSON.stringify({
                                    title: title,
                                    artist: artist,
                                    id: id
                                }));
                            } else {
                                $('.audio-' + id).removeClass('downloading').addClass('download-error');
                                tracker.sendEvent(userLabel, 'download.error', JSON.stringify({
                                    title: title,
                                    artist: artist,
                                    id: id
                                }));
                            }
                        }, {
                            id: id,
                            url: url,
                            title: title,
                            artist: artist
                        });
                        e.preventDefault();
                    });
                } else {
                    //todo: already downloaded
                }
                $audio.find('.checkbox input').on('change', function (e) {
                    checkButton();
                });
                $('.audios').append($audio);
            }
            $('.audios-num').text(i);

            if(method == 'getAlbumAudios') {
                var $badge = $('.albums .active').find('.badge');
                $badge.removeClass('hide');
                $badge.text(response.count);
            }

            var pages = response.count / response.num;
            if((i < response.num && response.count >= response.num) || (response.num > i && response.num > response.count && response.count > i)) {
                var percent;
                if((response.num > i && response.num > response.count && response.count > i)) percent = (100 - (i / response.count * 100)).toFixed(0);
                else percent = (100 - (i / response.num * 100)).toFixed(0);
                $('.audios-loss').html("-" + percent + "%").removeClass('hide').addClass('show').tooltip('destroy').attr('title', percent + '% удалённых треков').tooltip('fixTitle').tooltip({
                    placement: 'right'
                });
            } else {
                $('.audios-loss').removeClass('show').addClass('hide');
            }
            // console.log('pages', pages, response);
            var paginationPrefix = '#my-page-';
            var $pag_wrapper = $('.pagination-container');
            $loader.hide();
            if(pages !== $pag_wrapper.find('.owl-stage > div').length){
                $pag_wrapper.find('.pagination').remove();
                $pag_wrapper.append('<div class="pagination"></div>');
                for(var i = 0; i < pages; i++) {
                    // console.log(i, response.page, i == response.page);
                    $pag_wrapper.find('.pagination').append('<a href="' + paginationPrefix + (i + 1) + '"' + (i == response.page ? ' class="current-page"' : '') + ' data-hash="' + paginationPrefix + (i + 1) + '">' + (i + 1) + '</a>');
                }
                var owl = $pag_wrapper.find('.pagination');
                owl.owlCarousel({
                    loop: false,
                    dots: false,
                    center: true,
                    URLhashListener: false,
                    slideBy: 3,
                    // margin: 5,
                    startPosition: response.page,
                    loadedClass: 'owl-carousel owl-loaded',
                    onInitialized: function(){
                        $pag_wrapper.find('.pagination .owl-item a').on('click', function(){
                            var $that = $(this),
                                page = $that.text();
                            $pag_wrapper.find('.pagination .owl-item a').removeClass('current-page');
                            $that.addClass('current-page');
                            console.log('pagination clicked', page);
                            lastContentSendMessage.page = parseInt(page) - 1;
                            getAudios(lastContentSendMessage);
                            // if(count && count > 0) {
                            //     lastContentSendMessage.count = count;
                            //     getAudios(lastContentSendMessage);
                            // }
                        });
                    },
                    responsive:{
                        0:{
                            items: 6
                        },
                        600:{
                            items: 10
                        },
                        768:{
                            items: 12
                        },
                        1100:{
                            items: 16
                        },
                        1368:{
                            items: 25
                        }
                    }
                });
                owl.on('mousewheel', '.owl-stage', function (e) {
                    if (e.deltaY > 0) {
                        owl.trigger('next.owl');
                    } else {
                        owl.trigger('prev.owl');
                    }
                    e.preventDefault();
                });

                $pag_wrapper.find('.left-arrow').on('click', function(){
                    owl.trigger('prev.owl');
                });
                $pag_wrapper.find('.right-arrow').on('click', function(){
                    owl.trigger('next.owl');
                });
                //$pag_wrapper.children().fadeOut(100);
            }
            $(window).trigger('resize');
            if(callback) callback(response);
        }
    }, params || {});
}
function getImageBlob(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function(e) {
        callback(window.URL.createObjectURL(this.response));
    };
    xhr.send();
}
$(document).ready(function(){
    $(window).on('resize', function(){
        var windowHeight = $(window).height(),
            playerHeight = $('.player-container').outerHeight(),
            headerHeight = $('.albums-container h4').outerHeight(),
            paginationHeight = $('.pagination').outerHeight(),
            navHeight  = $('.navbar').outerHeight();
        console.log('windowHeight', windowHeight);
        console.log(windowHeight, playerHeight, headerHeight);
        $('.albums .list-group').height(windowHeight - playerHeight - headerHeight - navHeight - 20);
        $('.audios').height(windowHeight - paginationHeight - headerHeight - navHeight - 20);
    });
    console.log('launchData', window.launchData);
    console.log('vkData', vkData);
    console.log('downloads', downloads);
    if(downloads) $('.downloads-count').text(Object.keys(downloads).length);
    $('.logout').on('click', function(e){
        sendMessage('logout', function(response){
            tracker.sendEvent(userLabel, 'logout');
        });
        e.preventDefault();
    });
    $('.download-manager a').on('click', function(e){
        sendMessage('openDownloadManager', function(response){
            
        });
        e.preventDefault();
    });
    $('.login-btn').on('click', function(e){
        var $that = $(this);
        $that.find('.loading').removeClass('hide').addClass('show');
        $that.find('.vk-logo').css('opacity', 0);
        sendMessage('authorize', function(response){
            tracker.sendEvent('User', 'authorize', response.user_id);
            if(!response.error) {//logged in
                $that.find('.loading').removeClass('show').addClass('hide');
                $that.find('.vk-logo').css('opacity', 1);
                //open next window
            } else {

            }
        });
        e.preventDefault();
    });
    $('.tracks-num > a').on('click', function(e){
        var $that = $(this),
            count = $that.data('num');
        $that.siblings().removeClass('label-primary').addClass('label-default');
        $that.removeClass('label-default').addClass('label-primary');
        if(count && count > 0) {
            lastContentSendMessage.count = count;
            getAudios(lastContentSendMessage);
        }
        e.preventDefault();
    });
    $('#select-all').on('change', function(e){
        var $that = $(this),
            checked = $(this).prop('checked');
        $('.audios .audio').each(function(i, e){
            var $audio = $(this);
            $audio.find('.checkbox input').prop('checked', checked)
        });
        checkButton();
    });
    $('.bulk-download').on('click', function(){
        if(selectedAudios.length > 0) {
            sendMessage('startBulkAudioDownload', function (response) {
                console.log('startBulkAudioDownload', response);
            }, selectedAudios);
        } else {
            console.error('Nothing to download');
        }
    });
    var $user = $('.user');
    if($user.length > 0) {
        sendMessage('getMyInfo', function(response){
            if(response.first_name) $user.find('.user-name').text(response.first_name);
            if(response.photo_50) {
                getImageBlob(response.photo_50, function(blobData){
                    $user.find('.user-avatar').attr('src', blobData);
                });
            }
        });
        sendMessage('getAlbums', function(response){
            if(response.count) {
                $('.albums-count').text(response.count);
            }
            if(response.items) {
                $.each(response.items, function(i, e){
                    var $album = $('<a href="#" class="list-group-item album" data-id="' + e.album_id + '"><span>' + e.title + '</span><i class="fa fa-cart-arrow-down hide" aria-hidden="true" title="Add to Download List"></i><span class="badge hide">?</span></a>');
                    $album.on('click', function(){
                        var $that = $(this),
                            album_id = $that.data('id');
                        $that.siblings().removeClass('active');
                        $that.addClass('active');
                        getAudios({
                            album_id: album_id
                        }, function(){

                        }, 'getAlbumAudios');
                        // sendMessage('getAlbumAudios', function(albumAudios){
                        //     if(albumAudios.count) {
                        //         $('.albums-count').text(albumAudios.count);
                        //     }
                        //     if(albumAudios.items) {
                        //         console.log('albums', albumAudios);
                        //     }
                        // }, {album_id});
                    });
                    $('.albums .list-group').append($album);
                });
                $(window).trigger('resize');
            }
        });
        getAudios();
        $('.get-audios').on('click', function(){
            getAudios();
        });
    }
});