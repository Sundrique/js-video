var VolumeSample = {};
VolumeSample.gainNode = null;
VolumeSample.play = function () {
	this.gainNode = context.createGainNode();
	var source = context.createBufferSource();
	source.buffer = BUFFERS.techno;
	source.connect(this.gainNode);
	this.gainNode.connect(context.destination);
	source.loop = true;
	source.noteOn(0);
	this.source = source;
};
VolumeSample.changeVolume = function (element) {
	var volume = element.value;
	var fraction = parseInt(element.value) / parseInt(element.max);
	this.gainNode.gain.value = fraction * fraction;
};
VolumeSample.stop = function () {
	this.source.noteOff(0);
};
VolumeSample.toggle = function () {
	this.playing ? this.stop() : this.play();
	this.playing = !this.playing;
};