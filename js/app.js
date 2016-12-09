var lastContentSendMessage = null;

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
        if(action == 'getAudios') lastContentSendMessage = msg;
        chrome.runtime.sendMessage(msg, function(response){
            if(callback) callback(response);
            console.log('action', action, 'response', response);
            if(chrome.runtime.lastError) console.error('action', action, chrome.runtime.lastError);
        });
    }
}
function getAudios(params, callback) {
    sendMessage('getAudios', function(response){
        if(response.items) {
            $('.audios').empty();
            if(response.num) {
                $('.audios-num').text(response.num);
            }
            for(var i = 0; i < response.items.length; i++) {
                var e = response.items[i],
                    id = e.owner_id + "_" + e.id;
                var $audio = $('<div class="audio" data-owner-id="' + e.owner_id + '" data-audio-id="' + e.id + '"><div class="left">' +
                    '<a href="#"><i class="fa fa-play-circle fa-2x" aria-hidden="true"></i></a></div>' +
                    '<div class="middle"><h5><span class="artist">' + e.artist + '</span> - <span class="title" title="' + e.title + '">' + e.title + '</span></h5>' +
                    '</div><div class="right"><div class="checkbox">' +
                    '<input type="checkbox" value="None" id="checkbox-' + id + '" name="check" />' +
                    '<label for="checkbox-' + id + '"></label></div>' +
                    '<a href="' + e.url + '" class="download" title="Download Audio"><i class="fa fa-download" aria-hidden="true"></i></a>' +
                    '<span class="duration" data-duration="' + e.duration + '">' + (e.duration + "").toHHMMSS() + '</span>' +
                    '</div>' +
                    '</div>');
                $audio.find('.download').on('click', function(e){
                    var $that = $(this),
                        $parent = $that.parent().parent(),
                        href = $that.attr('href'),
                        artist = $parent.find('.artist').text(),
                        title = $parent.find('.title').text(),
                        audio_id = $parent.data('audio-id'),
                        owner_id = $parent.data('owner-id'),
                        id = owner_id + "_" + audio_id;
                    sendMessage('addAudioDownload', function(response){
                        if(response && !response.error && response.count) {
                            $('.downloads-count').text(response.count);
                        }
                    }, {
                        id: id,
                        href: href,
                        title: title,
                        artist: artist
                    });
                    console.log('download', href, artist, title);
                    e.preventDefault();
                });
                $('.audios').append($audio);
            }
            var pages = response.count / response.num;
            if(i < response.num) {
                var percent = (100 - (i / response.num * 100));
                $('.audios-loss').html("-" + percent + "%").removeClass('hide').addClass('show').attr('title', percent + '% удалённых треков');
            } else {
                $('.audios-loss').removeClass('show').addClass('hide');
            }
            var paginationPrefix = '#my-page-';
            var $pag_wrapper = $('.pagination-container');
            if(pages !== $pag_wrapper.find('.owl-stage > div').length){
                $pag_wrapper.empty();
                $pag_wrapper.append('<div class="pagination"></div>');
                for(var i = 0; i < response.count / (response.num) - 200; i++) {
                    $pag_wrapper.find('.pagination').append('<a href="' + paginationPrefix + (i + 1) + '"' + (i == response.page ? ' class="selected"' : '') + ' data-hash="' + paginationPrefix + (i + 1) + '">' + (i + 1) + '</a>');
                }
                var owl = $pag_wrapper.find('.pagination');
                owl.owlCarousel({
                    loop: false,
                    dots: false,
                    center: true,
                    URLhashListener: true,
                    slideBy: 3,
                    margin: 5,
                    startPosition: response.page,
                    loadedClass: 'owl-carousel owl-loaded',
                    responsive:{
                        0:{
                            items:10
                        },
                        600:{
                            items:14
                        },
                        768:{
                            items:16
                        },
                        1368:{
                            items:25
                        },
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

                // $('.controls .fa-chevron-circle-right').on('click', function(){
                //     owl.trigger('next.owl');
                // });
                // $('.controls .fa-chevron-circle-left').on('click', function(){
                //     owl.trigger('prev.owl');
                // });
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
    console.log('vkData', window.vkData);
    console.log('downloads', window.downloads);
    if(window.downloads) $('.downloads-count').text(Object.keys(window.downloads).length);
    $('.logout').on('click', function(e){
        sendMessage('logout', function(response){

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
                    var $album = $('<a href="#" class="list-group-item album" data-id="' + e.album_id + '"><span>' + e.title + '</span><i class="fa fa-cart-arrow-down" aria-hidden="true" title="Add to Download List"></i></a>');
                    $('.albums .list-group').append($album);
                });
                $(window).trigger('resize');
            }
        });
        getAudios();
    }
});