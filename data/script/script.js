var janus = null;
var streaming = null;
var bitrateTimer = null;
var opaqueId = "streamingtest-" + Janus.randomString(12);
var selectedStream = 1;

$(document).ready(function() {
	OnDocumentReady();
});

function OnDocumentReady() {
  SetupUiInteractions();
	Janus.init({callback: OnJanusInit, debug: "all"});
}

function OnJanusInit() {
	StartSession();
}

function StopSession() {
	clearInterval(bitrateTimer);
	janus.destroy();
}

function SetupUiInteractions() {
	var elem = document.getElementById("container");
	elem.ondblclick = function() {
		if (!document.fullscreenElement && !document.mozFullScreenElement &&
				!document.webkitFullscreenElement && !document.msFullscreenElement) {
			if (elem.requestFullscreen) {
				elem.requestFullscreen({ navigationUI: "hide" });
			} else if (elem.msRequestFullscreen) {
				elem.msRequestFullscreen();
			} else if (elem.mozRequestFullScreen) {
				elem.mozRequestFullScreen();
			} else if (elem.webkitRequestFullscreen) {
				elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
			}
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		}
	};
}

function StartSession() {
	if(!Janus.isWebrtcSupported()) {
		alert("error: no webrtc support");
		return;
	}

	janus = new Janus({
		token: token,
		server: server,
		success: function() {
			// attach to streaming plugin
			janus.attach({
				plugin: "janus.plugin.streaming",
				opaqueId: opaqueId,

				success: function(pluginHandle) {
					$('#details').remove();
					streaming = pluginHandle;

					Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");

					startStream();
				},


				error: function(error) {
					Janus.error("  -- Error attaching plugin... ", error);
					alert("error: attach plugin: " + error);
				},
				iceState: function(state) {
					Janus.log("ICE state changed to " + state);
				},
				webrtcState: function(on) {
					Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
				},
				onmessage: function(msg, jsep) {
					Janus.debug(" ::: got a message :::", msg);
					var result = msg["result"];
					if (result) {
						if (result["status"]) {
							var status = result["status"];
							if(status === 'starting')
								$('#cur_status').text("starting").show();
							else if(status === 'started')
								$('#cur_status').text("started").show();
							else if(status === 'stopped')
								stopStream();
						} else if(msg["streaming"] === "event") {
						}
					} else if(msg["error"]) {
						alert(msg["error"]);
						stopStream();
						return;
					}

					if (jsep) {
						Janus.debug("Handling SDP as well...", jsep);
						var stereo = (jsep.sdp.indexOf("stereo=1") !== -1);
						// Offer from the plugin, let's answer
						streaming.createAnswer(
							{
								jsep: jsep,
								// We want recvonly audio/video and, if negotiated, datachannels
								media: { audioSend: false, videoSend: false, data: true },
								customizeSdp: function(jsep) {
									if(stereo && jsep.sdp.indexOf("stereo=1") == -1) {
										// Make sure that our offer contains stereo too
										jsep.sdp = jsep.sdp.replace("useinbandfec=1", "useinbandfec=1;stereo=1");
									}
								},
								success: function(jsep) {
									Janus.debug("Got SDP!", jsep);
									var body = { request: "start" };
									streaming.send({ message: body, jsep: jsep });
									$('#watch').html("Stop").removeAttr('disabled').click(stopStream);
								},
								error: function(error) {
									Janus.error("WebRTC error:", error);
									alert("error: webtrc: " + error.message);
								}
							});
					}

				},

				onremotestream: function(stream) {
					Janus.debug("::: got a remote stream :::", stream);


					$("#remotevideo").bind("playing", function () {
						$('#waitingvideo').remove();

						var videoTracks = stream.getVideoTracks();
						if(!videoTracks || videoTracks.length === 0)
							return;
						var width = this.videoWidth;
						var height = this.videoHeight;
						$('#cur_resolution').text(width+'x'+height).show();
						if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
							// firefox stable has a bug: width and height are not immediately available after a playing
							setTimeout(function() {
								var width = $("#remotevideo").get(0).videoWidth;
								var height = $("#remotevideo").get(0).videoHeight;
								$('#cur_resolution').text(width+'x'+height).show();
							}, 2000);
						}
					});

					Janus.attachMediaStream($('#remotevideo').get(0), stream);
					$("#remotevideo").get(0).volume = 0;
					$("#remotevideo").get(0).play();

					var videoTracks = stream.getVideoTracks();
					if(!videoTracks || videoTracks.length === 0) {
						// No remote video
						//$('#remotevideo').hide();
						if($('#stream .no-video-container').length === 0) {
							$('#stream').append(
								'<div class="no-video-container">' +
									'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
									'<span class="no-video-text">No remote video available</span>' +
								'</div>');
						}
					} else {
						$('#stream .no-video-container').remove();
					}

					if (videoTracks && videoTracks.length &&
							(Janus.webRTCAdapter.browserDetails.browser === "chrome" ||
								Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
								Janus.webRTCAdapter.browserDetails.browser === "safari")) {

						bitrateTimer = setInterval(function() {
							var bitrate = streaming.getBitrate();
							$('#cur_bitrate').text(bitrate);
							var width = $("#remotevideo").get(0).videoWidth;
							var height = $("#remotevideo").get(0).videoHeight;
							if (width > 0 && height > 0) {
								$('#cur_resolution').text(width+'x'+height).show();
							}
						}, 200);

					}
				},

				ondataopen: function(data) {
					Janus.log("The DataChannel is available!");
					$('#waitingvideo').remove();
					$('#stream').append(
						'<input class="form-control" type="text" id="datarecv" disabled></input>'
					);
				},

				ondata: function(data) {
					Janus.debug("We got data from the DataChannel!", data);
					$('#datarecv').val(data);
				},

				oncleanup: function() {
					Janus.log(" ::: Got a cleanup notification :::");
					$('#waitingvideo').remove();
					//$('#remotevideo').remove();
					$('#datarecv').remove();
					$('.no-video-container').remove();
					$('#bitrate').attr('disabled', true);
					$('#bitrateset').html('Bandwidth<span class="caret"></span>');
					if(bitrateTimer)
						clearInterval(bitrateTimer);
					bitrateTimer = null;
					$('#metadata').empty();
					$('#info').addClass('hide').hide();
				}

			});
		},
		error: function(error) {
			Janus.error(error);
			alert(error, function() {
				//window.location.reload();
			});
		},
		destroyed: function() {
			//window.location.reload();
		}
	});
}

function startStream() {
	Janus.log("selected stream: " + selectedStream);
	if(!selectedStream) {
		alert("error: no stream selected");
		return;
	}

	var body = { request: "watch", id: selectedStream };
	streaming.send({ message: body });
	// no remote video yet
	$('#stream').append('<video class="rounded centered" id="waitingvideo" width="100%" height="100%" />');

	// get some more info for the mountpoint to display, if any
	getStreamInfo();
}

function stopStream() {
	var body = { request: "stop" };
	streaming.send({ message: body });
	streaming.hangup();
	//$('#cur_status').empty();
	//$('#cur_bitrate').empty();
	//$('#cur_resolution').empty();
	if (bitrateTimer) {
		clearInterval(bitrateTimer);
	}
	bitrateTimer = null;
}

function getStreamInfo() {
	$('#metadata').empty();

	if (!selectedStream) {
		return;
	}

	// send a request for more info on the mountpoint we subscribed to
	var body = {
		request: "info",
		id: parseInt(selectedStream) || selectedStream
	};
	streaming.send({
		message: body,
		success: function(result) {
			if (result && result.info && result.info.metadata) {
				$('#metadata').html(escapeXmlTags(result.info.metadata));
				$('#info').removeClass('hide').show();
			}
		}
	});
}

// helper to escape xml tags
function escapeXmlTags(value) {
	if(!value) {
		return;
	}
	var escapedValue = value.replace(new RegExp('<', 'g'), '&lt');
	escapedValue = escapedValue.replace(new RegExp('>', 'g'), '&gt');
	return escapedValue;
}

// vim:set ts=2 sw=2 noet:
