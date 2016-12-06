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
$(document).ready(function(){
    console.log('launchData', launchData);
    console.log('vkData', vkData);
    $('.login-btn').on('click', function(){
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
    });
});