/**
 * Created by 4Matic on 6.12.2016.
 */
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
function authInfo(response) {
    if (response.session) {
        alert('user: '+response.session.mid);
    } else {
        alert('not auth');
    }
}
VK.Widgets.Auth("vk_auth", {width: "200px", onAuth: function(data) {
    alert('user '+data['uid']+' authorized');
} });
VK.Auth.getLoginStatus(authInfo);
// VK.UI.button('login_button');
function initLogin() {
    VK.Auth.login(authInfo, 8);
}
$(document).ready(function(){
    $('.login-btn').on('click', function(){
        initLogin();
    });
});