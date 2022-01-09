var g_janus = null;
var g_streaming = null;
var g_bitrate_timer = null;
var g_opaque_id = "psi-" + Janus.randomString(12);
var g_pending_stream_id = null;

$(document).ready(function() {
	OnDocumentReady();
});

function OnDocumentReady() {
  VideoLayoutInit();
	Janus.init({callback: OnJanusInit, debug: "all"});
}

function OnJanusInit() {
	StartSession();
}

function StopSession() {
  StreamPropsTimerStop();
	g_janus.destroy();
}

function VideoLayoutControlsVisible(layout, visible) {
	var ui = layout.getElementsByClassName("ui")[0];
	if (!visible) {
		ui.classList.add("hidden");
	} else {
		ui.classList.remove("hidden");
	}
}

function VideoLayoutUpdateStatus(status) {
	let html_status = document.getElementById("cur_status");
	html_status.innerText = status;
}

function VideoLayoutSetUpFullscreenAction(layout) {
	var screen = layout.getElementsByClassName("screen")[0];
	var video = screen.getElementsByTagName("video")[0];
	screen.ondblclick = function () {
		if (document.fullscreenElement || document.mozFullScreenElement ||
				document.webkitFullscreenElement || document.msFullscreenElement) {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		} else {
			if (video.requestFullscreen) {
				video.requestFullscreen({ navigationUI: "hide" });
			} else if (video.msRequestFullscreen) {
				video.msRequestFullscreen();
			} else if (video.mozRequestFullScreen) {
				video.mozRequestFullScreen();
			} else if (video.webkitRequestFullscreen) {
				video.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
			}
		}
	};
}

function VideoLayoutInit() {
	var layout = document.getElementsByClassName("video-layout")[0];
	VideoLayoutSetUpFullscreenAction(layout);
}


function UpdateStreamsList() {
	var body = { request: "list" };
	Janus.debug("sending message:", body);
	g_streaming.send({
		message: body,
		success: function(result) {
			if (!result) {
				Janus.error("error: failed to get available streams");
				alert("no available streams");
				return;
			}
			var list = result["list"];
			if (!list) {
				Janus.error("error: streams list is empty");
				alert("no available streams");
				return;
			}
			if (!Array.isArray(list)) {
				Janus.error("error: streams list is not an array");
				alert("no available streams");
				return;
			}
			Janus.log("got a list of available streams");
			list.sort(function(a, b) {
				if(!a || a.id < (b ? b.id : 0)) {
					return -1;
				} else if(!b || b.id < (a ? a.id : 0)) {
					return 1;
				} else {
					return 0;
				}
			});
			Janus.debug(list);
			var html_streams = document.getElementById("streams");
			for (let i in list) {
				let button = document.createElement('button');
				button.innerHTML = list[i]["description"];
				button.onclick = function() { SwitchStream(list[i]["id"]); };
				let li = document.createElement('li');
				li.appendChild(button);
				html_streams.appendChild(li);
			}
			WatchStream(list[0]["id"]);
		}
	});
}

function StartSession() {
	if(!Janus.isWebrtcSupported()) {
		alert("error: no webrtc support");
		return;
	}

	g_janus = new Janus({
		token: token,
		server: server,

		success: function() {
			g_janus.attach({
				plugin: "janus.plugin.streaming",
				opaqueId: g_opaque_id,

				success: function(pluginHandle) {
					g_streaming = pluginHandle;
					Janus.log("plugin attached (" + g_streaming.getPlugin() + ", id=" + g_streaming.getId() + ")");
					UpdateStreamsList();
				},

				error: function(error) {
					Janus.error("error: failed to attach the plugin", error);
					alert("error: attach plugin: " + error);
				},

				iceState: function(state) {
					Janus.log("ICE state changed to " + state);
				},

				webrtcState: function(on) {
					Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
				},

				onmessage: function(msg, jsep) {
					Janus.debug(":::::: got a message ::::::", msg);
					let error = msg["error"];
					if (error) {
					  Janun.error(error);
						alert(error);
						StopStream();
						return;
					}

					let result = msg["result"];
					if (!result) {
					  Janun.error("error: result is empty");
						alert("invalid event from the gateway");
						return;
					}

					let status = result["status"];
					if (status) {
						VideoLayoutUpdateStatus(status);
						//if (status == "stopping") {
						//} else if (status == "stopped") {
						//	StopStream();
						//}
					}

					if (jsep) {
						Janus.debug("handling sdp", jsep);
						var stereo = (jsep.sdp.indexOf("stereo=1") !== -1);
						g_streaming.createAnswer({
							jsep: jsep,

							// we want recvonly audio/video and, if negotiated, datachannels
							media: { audioSend: false, videoSend: false, data: true },

							customizeSdp: function(jsep) {
								if(stereo && jsep.sdp.indexOf("stereo=1") == -1) {
									// make sure that our offer contains stereo too
									jsep.sdp = jsep.sdp.replace("useinbandfec=1", "useinbandfec=1;stereo=1");
								}
							},

							success: function(jsep) {
								Janus.debug("got sdp", jsep);
								var body = { request: "start" };
								g_streaming.send({ message: body, jsep: jsep });
							},

							error: function(error) {
								Janus.error("webrtc error:", error);
								alert("error: webtrc: " + error.message);
							}
						});
					}
				},

				onremotestream: function(stream) {
					Janus.debug("got a remote stream", stream);

					$("#video").bind("playing", function () {
						var videoTracks = stream.getVideoTracks();
						if(!videoTracks || videoTracks.length === 0)
							return;
						var width = this.videoWidth;
						var height = this.videoHeight;
						$('#cur_resolution').text(width+'x'+height).show();
						if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
							// firefox stable has a bug: width and height are not immediately available after a playing
							setTimeout(function() {
								var width = $("#video").get(0).videoWidth;
								var height = $("#video").get(0).videoHeight;
								$('#cur_resolution').text(width+'x'+height).show();
							}, 2000);
						}
					});

					Janus.attachMediaStream($('#video').get(0), stream);
					$("#video").get(0).volume = 0;
					$("#video").get(0).play();

					var videoTracks = stream.getVideoTracks();
					if(!videoTracks || videoTracks.length === 0) {
						var video = document.getElementById("video"); 
						//video.classList.add("hidden");

						//if($('#screen .no-video-container').length === 0) {
						//	$('#screen').append(
						//		'<div class="no-video-container">' +
						//			'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
						//			'<span class="no-video-text">No remote video available</span>' +
						//		'</div>');
						//}
					} else {
						//$('#screen .no-video-container').remove();
					}
					if (videoTracks && videoTracks.length) {
						StreamPropsTimerStart();
					}
				},

				ondataopen: function(data) {
					Janus.log("the datachannel is available");
				},

				ondata: function(data) {
					Janus.debug("we got data from the datachannel", data);
				},

				oncleanup: function() {
					Janus.log("got a cleanup notification");
					StreamPropsTimerStop();
					if (g_pending_stream_id) {
						WatchStream(g_pending_stream_id);
						g_pending_stream_id = null;
						return;
					}
				}
			});
		},

		error: function(error) {
			Janus.error(error);
			alert(error);
		},

		destroyed: function() {}
	});
}

function SwitchStream(id) {
	g_pending_stream_id = id;
	StopStream();
}

function WatchStream(id) {
  Janus.log("watch stream: " + id);
	var body = { request: "watch", id: id };
	g_streaming.send({ message: body });
}

function StopStream() {
	var body = { request: "stop" };
	g_streaming.send({ message: body });
	g_streaming.hangup();
	StreamPropsTimerStop();
}

function StreamPropsTimerStop() {
	if (g_bitrate_timer) {
		clearInterval(g_bitrate_timer);
	}
	g_bitrate_timer = null;
}

function StreamPropsTimerStart() {
	g_bitrate_timer = setInterval(function() {
		var bitrate = g_streaming.getBitrate();
		$('#cur_bitrate').text(bitrate);
		var width = $("#video").get(0).videoWidth;
		var height = $("#video").get(0).videoHeight;
		if (width > 0 && height > 0) {
			$('#cur_resolution').text(width+'x'+height).show();
		}
	}, 500);
}

// vim:set ts=2 sw=2 noet:
