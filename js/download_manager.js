(function() {
    var DownloadManager;
    Array.prototype.remove = function(from, to) {
        var rest = this.slice((to || from) + 1 || this.length);
        this.length = from < 0 ? this.length + from : from;
        return this.push.apply(this, rest);
    };

    DownloadManager = (function() {
        function DownloadManager() {
            this.queue = [];
            this.enRoute = [];
            this.maxRunningTasks = 4;
            this.curTaskNum = 0;
            this.paused = false;
            (function(_this){
                chrome.storage.local.get('maxRunningTasks', function (data) {
                    if(data.maxRunningTasks) _this.maxRunningTasks = data.maxRunningTasks;
                });
            })(this);
            (function(_this){
                $(window).on('maxRunningTasksChange', function(e, data){
                    _this.maxRunningTasks = parseInt(data);
                    // _this.runTasks();
                    // console.log('maxRunningTasksChange', _this, data);
                });
            })(this);
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
        DownloadManager.prototype.addTask = function(audio, downloading, run) {
            var add, task;
            if(typeof run == "undefined") run = true;
            add = !downloading ? 'push' : 'unshift';
            if (downloading == null) {
                downloading = new $.Deferred();
            }
            var url = audio && audio.url ? audio.url : '';
            // delete audio.url;
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
            if(run) this.runTasks();
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
            // var messageDef = task.promise;
            //must send message to download manager window
            console.log('task', task);
            var that = this;
            var recurClean = function(task){
                if(task === undefined && that.queue.length > 0) {
                    recurClean(that.queue.shift());
                } else return task;
            };
            if(task) {
                task = recurClean(task);
                console.log('nexttask', task);
                this.enRoute.push(task);
                this.curTaskNum++;
                task.numRetries++;
                messageSending = this.sendMessage('runNextTask', task);
                messageSending.done((function (_this) {
                    return function (downloadInfo, promise) {
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
                messageSending.fail((function (_this) {
                    return function (error, promise) {
                        // promise.reject(task);
                        // if (task.numRetries < 3) {
                        //     return _this.addTask(task, promise);
                        // }
                    };
                })(this));
            }
            return messageSending;
        };

        DownloadManager.prototype.indexOf = function(audio) {
            var id = false;
            if(audio.data && audio.data.audio && audio.data.audio.id) id = audio.data.audio.id;
            if(audio.audio && audio.audio.id) id = audio.audio.id;
            if(audio.id) id = audio.id;
            var indexes = [];
            var _that = this;
            var foundAudio = $.grep(_that.enRoute, function(e, index){
                console.log('indexOf', e, index, id, audio);
                if((e && e.id == id) || (e && e.audio && id == e.audio.id)) {
                    indexes.push(index);
                    return true;
                } else return false;
            });
            if(indexes.length > 0) {
                return indexes[0];
            } else return false;
        };
        DownloadManager.prototype.removeAudio = function(audio) {
            var index = this.indexOf(audio);
            console.log('remove audio', index, audio);
            if(index !== false) {
                this.enRoute.splice(index, 1);
                // task.promise.resolve(imgBlobUrl);
                this.curTaskNum--;
                this.runTasks();
            }
        };
        DownloadManager.prototype.getAudio = function(audio) {
            var index = this.indexOf(audio);
            if(index !== false) {
                return this.enRoute[index];
            } else return false;
        };
        DownloadManager.prototype.pause = function(audio) {
            var foundAudio = this.getAudio(audio);
            if(foundAudio.length > 0) {
                var downloadingTask = this.sendMessage('pauseDownloadingTask', foundAudio[0]);
                downloadingTask.done(function(audio){
                    console.log('paused downloading', audio);
                });
                // this.addTask(task, task.promise);
            }
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

        DownloadManager.prototype.resume = function(audio) {
            var foundAudio = this.getAudio(audio);
            console.log('DownloadManager.prototype.resume', foundAudio[0]);
            if(foundAudio.length > 0) {
                this.addTask(foundAudio[0], foundAudio[0].promise);
                return this.runTasks();
            }
        };

        window.DownloadManager = DownloadManager;

        return DownloadManager;

    })();

}).call(this);