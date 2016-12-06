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
        chrome.runtime.sendMessage(msg, function(response){
            if(callback) callback(response);
            console.log('action', action, 'response', response);
            if(chrome.runtime.lastError) console.error('action', action, chrome.runtime.lastError);
        });
    }
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
        var windowHeight = $(window).height();
        console.log('windowHeight', windowHeight);
        $('.albums .list-group').height(windowHeight - 100);
        $('.audios').height(windowHeight - 170);
    });
    console.log('launchData', window.launchData);
    console.log('vkData', window.vkData);
    $('.logout').on('click', function(e){
        sendMessage('logout', function(response){

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
        sendMessage('getAudios', function(response){
            if(response.num) {
                $('.audios-num').text(response.num);
            }
            if(response.items) {
                $.each(response.items, function(i, e){
                    var id = e.owner_id + "_" + e.id;
                    var $audio = $('<div class="audio" data-owner-id="' + e.owner_id + '" data-audio-id="' + e.id + '"><div class="left">' +
                        '<a href="#"><i class="fa fa-play-circle fa-2x" aria-hidden="true"></i></a></div>' +
                        '<div class="middle"><h5><span>' + e.artist + '</span> - <span title="' + e.title + '">' + e.title + '</span></h5>' +
                        '</div><div class="right"><div class="checkbox">' +
                        '<input type="checkbox" value="None" id="checkbox-' + id + '" name="check" />' +
                        '<label for="checkbox-' + id + '"></label></div>' +
                        '<a href="' + e.url + '" class="download" title="Download Audio"><i class="fa fa-download" aria-hidden="true"></i></a>' +
                        '<span class="duration" data-duration="' + e.duration + '">' + (e.duration + "").toHHMMSS() + '</span>' +
                        '</div>' +
                    '</div>');
                    $('.audios').append($audio);
                });
                $(window).trigger('resize');
            }
        });
    }
});