var JSVideo = function (elSrc, elWidth, elHeight, replaceNodeId) {

	var fps = 25,
		_this = this;

	// Private methods
	var addEventListener = function (obj, event, listener) {
		if (window.addEventListener) {
			obj.addEventListener(event, listener, false);
		} else {
			obj.attachEvent('on' + event, listener);
		}
	}

	var spawnWorker = function (func) {
		var blob = new Blob(['(' + func + ').call(self);']);
		var worker = new Worker(window.webkitURL.createObjectURL(blob));
		return worker;
	}

	var currentAudioDuration,
		channelsCount,
		channelsData = [],
		BUFFER_SIZE = 1024;

	var onAudioDecoded = function (buffer) {
		currentAudioDuration = buffer.duration;
		if (channelsCount === undefined) {
			sampleRate = buffer.sampleRate;
			channelsCount = buffer.numberOfChannels;
			jsSoundNode = audioContext.createJavaScriptNode(BUFFER_SIZE, channelsCount, channelsCount);
		}
		for (var i = 0; i < channelsCount; i++) {
			channelsData[i] = buffer.getChannelData(i);
		}
		checkLoadedData();
	}

	var onVideoDecoded = function(e) {
		videoFrames.push(e.data);
		checkLoadedData();
	}

	var onError = function (error) {
		// do nothing
	}

	var currentSampleNo = 0;
	var onAudioProcess = function (e) {
		var outputChannelsData = [];
		for (var channelNo = 0; channelNo < channelsCount; channelNo++) {
			outputChannelsData[channelNo] = e.outputBuffer.getChannelData(channelNo);
		}

		for (var sampleNo = 0; sampleNo < outputChannelsData[0].length; sampleNo++) {

			if (currentSampleNo < channelsData[0].length) {
				for (var channelNo = 0; channelNo < channelsCount; channelNo++) {
					outputChannelsData[channelNo][sampleNo] = channelsData[channelNo][currentSampleNo];
				}
				currentSampleNo++;
			} else {
				onEnded();
			}
		}
	}

	var onEnded = function () {
		_this.pause();
		//playTime = pauseTime = 0;
	}

	var audioDuration,
		videoDuration;
	var onMessage = function () {
		var data = event.data.split('~~');
		switch (data[0]) {
			case 'audio':
				if (!updateSoundInterval) {
					updateSoundInterval = setInterval(updateSound, 500);
				}
				audioData += data[1];
				break;
			case 'video':
				if (!updateVideoInterval) {
					updateVideoInterval = setInterval(updateVideo, 500);
				}
				videoData += data[1];
				break;
			case 'metadata':
				var metadata = JSON.parse(data[1]);
				fps = parseInt(metadata.fps);
				videoWidth = parseInt(metadata.width);
				videoHeight = parseInt(metadata.height);
				audioDuration = parseInt(metadata.audioDuration) / 1000;
				videoDuration = parseInt(metadata.videoDuration) / 1000;
				console.dir(metadata);
				duration = Math.max(audioDuration, videoDuration);
				//todo fire metadata loaded event
				break;
			default:
				throw new Error('Unknown data type');
				break;
		}
	}

	var updateSoundInterval,
		updateVideoInterval,
		audioData = '',
		videoData = '';

	var Uint8Concat = function (first, second) {
		var firstLength = first.length;
		var result = new Uint8Array(firstLength + second.length);

		result.set(first);
		result.set(second, firstLength);

		return result;
	}

	var previousFrameNo = -1,
		drawTimeout,
		REDRAW_INTERVAL = 10,
		videoFrames = [],
		offscreenCanvas = document.createElement('canvas'),
		offscreenContext = offscreenCanvas.getContext('2d');

	var draw = function () {
		drawTimeout = setTimeout(draw, REDRAW_INTERVAL);
		var frameNo = Math.min(Math.floor(_this.currentTime() * fps), videoFrames.length - 1);

		if (previousFrameNo != frameNo && videoFrames[frameNo] !== undefined) {
			var output = offscreenContext.createImageData(videoWidth, videoHeight);

			for(var i = 0; i < videoFrames[frameNo].length; i++) {
				output.data[i] = videoFrames[frameNo][i];
			}

			var ratio = Math.min(width / videoWidth, height / videoHeight);
			var newVideoWidth = videoWidth * ratio;
			var newVideoHeight = videoHeight * ratio;
			var dX = (width - newVideoWidth) / 2;
			var dY = (height - newVideoHeight) / 2;

			offscreenCanvas.width = videoWidth;
			offscreenCanvas.height = videoHeight;
			offscreenContext.putImageData(output, 0, 0);
			canvas2DContext.drawImage(offscreenCanvas, 0, 0, videoWidth, videoHeight, dX, dY, newVideoWidth, newVideoHeight);
			previousFrameNo = frameNo;
		}
	}

	var checkProgress = function () {
		var playProgress = _this.currentTime() / duration * 100;
		document.getElementById('play-progress').style.width = playProgress + '%';
		// TODO fire progress event
	}

	var checkLoadedData = function () {
		var audioLoadProgress = currentAudioDuration / audioDuration;
		var videoLoadProgress = (videoFrames.length / fps) / videoDuration;
		//var currentDuration = Math.min(currentAudioDuration, videoFrames.length / fps);
		var loadProgress =  Math.min(audioLoadProgress, videoLoadProgress) * 100;
		document.getElementById('load-progress').style.width = loadProgress + '%';
		// TODO fire loadeddata event
	}

	var previousDataLength = 0;

	var updateSound = function () {
		var newDataLength = Math.floor(audioData.length / 4) * 4;
		if (newDataLength > previousDataLength) {
			var message = {
				type: 'audio',
				value: audioData.substr(previousDataLength, newDataLength - previousDataLength)
			}
			worker.postMessage(message);
			previousDataLength = newDataLength;
		}
	}

	var previousVideoDataLength = 0;

	var updateVideo = function () {
		var newDataLength = Math.floor(videoData.length / 4) * 4;
		if (newDataLength > previousVideoDataLength) {
			var message = {
				type: 'video',
				value: videoData.substr(previousVideoDataLength, newDataLength - previousVideoDataLength)
			}
			worker.postMessage(message);
			previousVideoDataLength = newDataLength;
		}
	}

	var jsSoundNode;
	var playSound = function () {
		if (currentSampleNo >= channelsData[0].length) {
			currentSampleNo = 0;
		}
		jsSoundNode.onaudioprocess = onAudioProcess;
		jsSoundNode.connect(gainNode);

	}

	var pauseSound = function () {
		jsSoundNode.onaudioprocess = null;
		jsSoundNode.disconnect();
	}

	// Public API
	this.load = function () {
		var iframe = document.createElement('iframe');
		iframe.style.display = 'none';
		iframe.src = this.currentSrc();
		addEventListener(iframe, 'load', function () {
			//clearInterval(updateSoundInterval);
			//updateSound();
		});
		document.body.appendChild(iframe);
	}


	var progressInterval,
		iOSFixed = false;

	this.play = function () {
		if (!iOSFixed) {
			var source = audioContext.createBufferSource();
			source.connect(audioContext.destination);
			source.noteOn(0);
			source.noteOff(0);
			iOSFixed = true;
		}
		if (this.paused()) {
			progressInterval = setInterval(checkProgress, 10);
			playSound();
			paused = false;
			draw();
		}
	}

	this.pause = function () {
		clearInterval(progressInterval);
		paused = true;
		pauseSound();
	}

	var paused = true;
	this.paused = function () {
		return paused;
	}

	var volume = 1,
		audioContext = new webkitAudioContext(),
		gainNode = audioContext.createGainNode();

	gainNode.connect(audioContext.destination);

	this.volume = function (value) {
		if (value !== undefined && 0 <= value && value <= 1) {
			volume = value;
			gainNode.gain.value = value
		}
		return volume;
	}

	var sampleRate = 44100;
	this.currentTime = function (value) {
		if (value !== undefined) {
			currentSampleNo = Math.round(sampleRate * value);
		}

		return Math.min(this.duration(), currentSampleNo / sampleRate);
	}

	this.currentSrc = function () {
		return src;
	}

	this.canPlayType = function () {
		//if browser supports webworkers, canvas and audio api return true;
	}

	var duration = 0;
	this.duration = function () {
		return duration;
	}

	var width = 0;
	this.width = function (value) {
		if (value !== undefined) {
			this.el.width = width = value;
		}
		return width;
	}

	var height = 0;
	this.height = function (value) {
		if (value !== undefined) {
			this.el.height = height = value;
		}
		return height;
	}

	var videoWidth = 0;
	this.videoWidth = function () {
		return videoWidth;
	}

	var videoHeight = 0;
	this.videoHeight = function () {
		return videoHeight;
	}

	// Constructor
	addEventListener(window, 'message', onMessage);

	var worker = spawnWorker(function () {
		var Base64Binary = {
			_keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

			/* will return a  Uint8Array type */
			decodeArrayBuffer: function (input) {
				var bytes = (input.length / 4) * 3;
				var ab = new ArrayBuffer(bytes);
				this.decode(input, ab);

				return ab;
			},

			decode: function (input, arrayBuffer) {
				//get last chars to see if are valid
				var lkey1 = this._keyStr.indexOf(input.charAt(input.length - 1));
				var lkey2 = this._keyStr.indexOf(input.charAt(input.length - 2));

				var bytes = (input.length / 4) * 3;
				if (lkey1 == 64) bytes--; //padding chars, so skip
				if (lkey2 == 64) bytes--; //padding chars, so skip

				var uarray;
				var chr1, chr2, chr3;
				var enc1, enc2, enc3, enc4;
				var i = 0;
				var j = 0;

				if (arrayBuffer)
					uarray = new Uint8Array(arrayBuffer);
				else
					uarray = new Uint8Array(bytes);

				input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

				for (i = 0; i < bytes; i += 3) {
					//get the 3 octects in 4 ascii chars
					enc1 = this._keyStr.indexOf(input.charAt(j++));
					enc2 = this._keyStr.indexOf(input.charAt(j++));
					enc3 = this._keyStr.indexOf(input.charAt(j++));
					enc4 = this._keyStr.indexOf(input.charAt(j++));

					chr1 = (enc1 << 2) | (enc2 >> 4);
					chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
					chr3 = ((enc3 & 3) << 6) | enc4;

					uarray[i] = chr1;
					if (enc3 != 64) uarray[i + 1] = chr2;
					if (enc4 != 64) uarray[i + 2] = chr3;
				}

				return uarray;
			}
		}

		self.addEventListener('message', function (e) {
			var message = {
				type: e.data.type,
				value: Base64Binary.decode(e.data.value)
			}
			self.postMessage(message);
		}, false);
	});

	var decodeVideoWorker = new Worker('decode_video.js');

	decodeVideoWorker.addEventListener('message', onVideoDecoded);

	var audioBufferUint = new Uint8Array(0);

	worker.addEventListener('message', function (e) {
		if (e.data.type === 'audio') {
			audioBufferUint = Uint8Concat(audioBufferUint, e.data.value);
			audioContext.decodeAudioData(audioBufferUint.buffer, onAudioDecoded, onError);
		} else if (e.data.type === 'video') {
			decodeVideoWorker.postMessage(e.data.value);
		}
	}, false);

	var src = elSrc;

	this.el = document.createElement('canvas');
	this.width(elWidth);
	this.height(elHeight);
	var replaceNode = document.getElementById(replaceNodeId);
	replaceNode.parentNode.replaceChild(this.el, replaceNode);

	var canvas2DContext = this.el.getContext('2d');
	canvas2DContext.beginPath();
	canvas2DContext.rect(0, 0, this.width(), this.height());
	canvas2DContext.fillStyle = 'black';
	canvas2DContext.fill();
}