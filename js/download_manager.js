(function() {
    var DownloadManager;

    DownloadManager = (function() {
        function DownloadManager() {
            this.queue = [];
            this.enRoute = [];
            this.maxRunningTasks = 10;
            this.curTaskNum = 0;
            this.paused = false;
        }

        DownloadManager.prototype.sendMessage = function(action, data) {
            var message = new $.Deferred(), promise;
            if(data.hasOwnProperty('promise')) {
                promise = data.promise;
                delete data.promise;
            }
            if(data.hasOwnProperty('xhr')) delete data.xhr;
            chrome.runtime.sendMessage({
                action: action,
                data: data
            }, function(answer){
                if(!answer) {
                    if(chrome.runtime.lastError) {
                        return message.reject(chrome.runtime.lastError, promise);
                    }
                } else {
                    if(!answer.error) return message.resolve(answer, promise);
                    else return message.reject(answer.error, promise);
                }
            });
            return message;
        };
        DownloadManager.prototype.addTask = function(audio, downloading) {
            var add, task;
            add = !downloading ? 'push' : 'unshift';
            if (downloading == null) {
                downloading = new $.Deferred();
            }
            var url = audio && audio.url ? audio.url : '';
            delete audio.url;
            if(audio.hasOwnProperty('audio')) audio = audio.audio;
            task = {
                audio: audio,
                xhr: null,
                url: url,
                promise: downloading,
                numRetries: 0
            };
            this.queue[add](task);
            // console.log('DownloadManager.prototype.addTask', task, this.queue);
            this.runTasks();
            return downloading;
        };

        DownloadManager.prototype.runTasks = function() {
            var _results;
            _results = [];
            while ((this.queue.length !== 0) && (this.curTaskNum < this.maxRunningTasks) && !this.paused) {
                _results.push(this.runNextTask());
            }
            return _results;
        };

        DownloadManager.prototype.runNextTask = function() {
            var messageSending, task;
            task = this.queue.shift();
            this.enRoute.push(task);
            this.curTaskNum++;
            task.numRetries++;
            // var messageDef = task.promise;
            //must send message to download manager window
            messageSending = this.sendMessage('runNextTask', task);
            messageSending.done((function(_this) {
                return function(downloadInfo, promise) {
                    var i;
                    i = _this.enRoute.indexOf(task);
                    _this.enRoute.splice(i, 1);
                    // task.promise.resolve(imgBlobUrl);
                    _this.curTaskNum--;
                    promise.resolve(downloadInfo);
                    // console.log('messageSending.done', messageDef, downloadInfo);
                    return _this.runTasks();
                };
            })(this));
            messageSending.fail((function(_this) {
                return function(error, promise) {
                    // promise.reject(task);
                    if (task.numRetries < 3) {
                        return _this.addTask(task, promise);
                    }
                };
            })(this));
            return messageSending;
        };

        DownloadManager.prototype.pauseAll = function() {
            var task, _results;
            this.paused = true;
            _results = [];
            while (this.enRoute.length !== 0) {
                task = this.enRoute.shift();
                var downloadingTask = this.sendMessage('pauseDownloadingTask', task);
                downloadingTask.done(function(audio){
                    console.log('paused downloading', audio);
                });
                this.addTask(task, task.promise);
                _results.push(this.curTaskNum--);
            }
            return _results;
        };

        DownloadManager.prototype.resumeAll = function() {
            this.paused = false;
            return this.runTasks();
        };

        window.DownloadManager = DownloadManager;

        return DownloadManager;

    })();

}).call(this);