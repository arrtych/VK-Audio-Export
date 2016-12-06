/**
 * Created by 4Matic on 6.12.2016.
 */
window.vkAsyncInit = function() {
    VK.init({
        apiId: 5763233
    });
    VK.Widgets.Like("vk_like", {type: "button"});
    VK.Observer.subscribe("widgets.like.liked", function(){
        alert("Thank you for your like.");
    });
    VK.Observer.subscribe("auth.login", function(e){
        alert("auth.login");
        console.log(e);
    });
};
function initLogin() {
    VK.Auth.login(function (response) {
        if (response.session) {
            /* User is authorized successfully */
            if (response.settings) {
                /* Selected user access settings, if they were requested */
            }
        } else {
            /* User clicked Cancel button in the authorization window */
            alert(response.status);
        }
        console.log('response', response);
        VK.Auth.getLoginStatus(function(data){
            console.log('data', data);
        });
    }, 2);
}
$(document).ready(function(){
    $('.login-btn').on('click', function(){
        initLogin();
    });
});