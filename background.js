chrome.app.runtime.onLaunched.addListener(function(launchData) {
    chrome.app.window.create('index.html', {
        id: "welcomeWindow",
        innerBounds: {
            minWidth: 670,
            minHeight: 460,
            maxWidth: 800,
            maxHeight: 480
        }
        // resizable: false
    }, function(win) {
        console.log(chrome.runtime.getURL("img/login.png"));
        win.contentWindow.launchData = launchData;
    });
});