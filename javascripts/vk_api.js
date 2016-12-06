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
};
function initLogin() {
    VK.Auth.login(function (session, status) {
        if (status == 'connected') {
            alert('connected');
        } else if (status == 'not_authorized') {
            alert('not_authorized');
        } else {
            alert('unknown');
        }
        console.log(session, status);
    }, 8);
}
$(document).ready(function(){
    $('.login-btn').on('click', function(){
        initLogin();
    });
});