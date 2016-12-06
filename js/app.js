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
        sendMessage('authorize', function(response){

        });
    });
    if(Object.keys(vkData).length > 0) {

    }
});