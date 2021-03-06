define(function(require, exports, module) {

	var NO_AUDIO_DEFAULT_BGM = '/multimedia/empty.mp3';

	module.exports = {
		socket: null,
		audio: null,
		programs: [],
		program: {},
		queue: {
			data: [],
			callback: []
		},
		selectEvents: {
			toProgram: function(me, param) {

				me.sendRequest({
					method: "toProgram",
					param: param
				});
			}
		},
		buttonEvents: {
			toProgram: function(me, param) {
				var absId = getAbsoluteProgramId(me, param),
					subFunction = function() {
						me.program = me.programs[absId];
						me.initProgram();
					}
					// console.log("beforeId:  " + me.program.id + "    afterId: " + absId);

				me.sendRequest({
					method: "toProgram",
					param: {
						action: "absolute",
						pos: me.programs[absId].tagId
					}
				}, subFunction);

			},
			runJavaScript: function(me, param) {
				me.sendRequest({
					method: "runJavaScript",
					code: $("#text-javascript").val()
				});
			},
			sendBarrage: function(me, param) {
				me.sendRequest({
					method: "sendBarrage",
					text: $("#text-barrage").val()
				});
			}
		},

		sendRequest: function(data, callback) {

			if (!data) data = {};
			if (typeof(data) == 'string') data = {
				'method': data
			};
			if (!callback) callback = function() {}

			var queueLength = this.queue.data.length;
			this.queue.data[queueLength] = {
				data: data,
				id: queueLength
			};
			this.queue.callback[queueLength] = callback;
			this.socket.emit('screen', this.queue.data[queueLength]);
			console.log(this.queue.data[queueLength]);

		},
		initProgram: function(param) {
			var me = this;
			// 动态生成节目
			if (typeof me.program == "undefined") {
				me.program = {
					bgm: "",
					id: 0,
					program: {name: "动态生成"}, 
					player: {name: ""},
					display: []
				};
			}

			if (typeof(me.program.bgm) == "string") me.program.bgm = [me.program.bgm];
			if (me.program.bgm[0] == '' || me.program.bgm.length == 0) me.program.bgm[0] = NO_AUDIO_DEFAULT_BGM;

			$(".dom-playing-id").text(me.program.id);
			$(".dom-playing-name").text(me.program.program.name);
			$(".dom-playing-player").text(me.program.player.name);
			$(".dom-autoplay").text(((me.program.display.length > 0) ? (me.program.display[0].time ? "√" + (me.program.display[0].repeat ? "(repeat)" : "") : "×") : "×"));
			// This line ...

			var object = $("#controlselect-changebgm").html("");
			$.each(me.program.bgm, function(i, v) {
				$('<a href="#" class="list-group-item">').data("value", i)
					.attr("data-pos", i)
					.text(v)
					.appendTo(object);
			});
		},
		initSocket: function() {
			var me = this;
			this.socket = io.connect(location.origin);
			this.socket.on('error', function(err) {
				if (err && (err.code == 'ECONNREFUSED' || err.indexOf && err.indexOf('ECONNREFUSED') >= 0)) {
					var reconnecting = setTimeout(function() {
						me.socket.reconnect();
					}, 500); //assume a little threshold
					me.socket.on('connect', function() {
						clearTimeout(reconnecting);
						me.socket.removeListener('connect', arguments.callee);
					});
				}
			});

			this.socket.on('result', function(data) {
				var id = data.dataId;
				if (id >= 0 && me.queue.data[id]) {
					console.log('Request ' + id + ' finished!');
					me.queue.callback[id]();
					delete me.queue.data[id];
					delete me.queue.callback[id];
				}
			});

			this.socket.on('whoami', function() {
				me.socket.emit('whoami', 'controller');
				me.socket.emit('global', {
					"need": "data"
				});
			});

			this.socket.on('program-switch', function(data) {
				me.program = me.programs[data];
				me.initProgram();

				$("#controlselect-changeprogram").find('.active').removeClass('active');
				$("#controlselect-changeprogram").find("a").eq(data).addClass('active');
				// fix music-switch
				var findActive = $("#controlselect-changebgm");
				if (findActive.find('.active').length == 0) {
					findActive.find("a").eq(0).addClass("active");
				}
			});

			this.socket.on('music-switch', function(data) {
				var findActive = $("#controlselect-changebgm").find('.active');

				if (findActive.length == 0) {
					findActive = $("#controlselect-changebgm")
				} else {
					findActive = findActive.removeClass('active').parent();
				}
				findActive.find("a").eq(data).addClass("active");

			})

			return this;

		},

		initDom: function() {

			var me = this;

			this.socket.on('data', function(data) {
				me.programs = data;
				me.program = me.programs[0];
				//me.toProgram(0);

				var object = $("#controlselect-changeprogram").html("");
				$.each(me.programs, function(i, v) {
					v.tagId = i;
					$('<a href="#" class="list-group-item">').data("value", i)
						.attr("data-pos", v.program.id)
						.text(v.program.name + " - " + v.player.name)
						.appendTo(object);
				});
				me.program = me.programs[0];

			});


			$(".btn-command").click(function() {
				var that = $(this),
					command = that.data("command"),
					param = (typeof(that.data("param")) == 'object' ? that.data("param") : ((new Function('return ' + that.data("param")))()));

				if (me.buttonEvents[command]) {
					me.buttonEvents[command](me, param);
				} else {
					me.sendRequest({
						method: command,
						param: param
					});
				}

			});

			$(".select-command").on('click', '.list-group-item', function(e) {
				var that = $(this),
					parent = $(this).parent(),
					command = parent.data("command"),
					param = (typeof(parent.data("param")) == 'object' ? parent.data("param") : ((new Function('return ' + parent.data("param").replace("%val%", that.data("value"))))()));

				if (me.selectEvents[command]) {
					me.selectEvents[command](me, param);
				} else {
					me.sendRequest({
						method: command,
						param: param
					});
				}

				parent.find('.active').removeClass('active');
				that.addClass('active');

				e.preventDefault();

			});



			return this;

		},



	};



	var getAbsoluteProgramId = function(object, param) {

		if (param.method == "absolute") {
			return param.pos;
		}
		var nextId = param.pos + object.program.tagId; // - 1;
		//console.log("programId: " + object.program.id + ", pos: " + param.pos + "")

		if (nextId >= object.programs.length) {
			nextId %= (object.programs.length);
		} else if (nextId == NaN || nextId < 0) {
			nextId = 0;
		}

		return nextId; //object.programs[nextId].id;

	}

});