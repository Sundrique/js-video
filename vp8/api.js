function loadFile(url, callback) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'arraybuffer';

	xhr.onload = callback;

	xhr.send('');
}

function onFileLoaded(e) {
	var uInt8Array = new Uint8Array(this.response);
	var decoder = new WebMDecoder(uInt8Array);

	function getAndDraw() {
		setTimeout(function() {
			var imageData;
			if (imageData = decoder.getFrame()){
				vpximg2canvas(imageData);
				getAndDraw();
			}
		}, 0);
	}
	getAndDraw();
}

function WebMDecoder (fileData) {
	var buf = [null];
	var buf_off = [null];
	var buf_sz = [0], buf_alloc_sz = [0];
	var infile = {data: fileData, data_off: 0};
	var fourcc = [int_];
	var width = [int_];
	var height = [int_];
	var fps_den = [int_];
	var fps_num = [int_];
	var input = new input_ctx();

	input.infile = infile;
	if (file_is_webm(input, fourcc, width, height, fps_den, fps_num)) {
		input.kind = WEBM_FILE
	}
	else {
		alert("Unrecognized input file type.\n");
		return EXIT_FAILURE;
	}

	var isFrame;
	var decoderContext = new vp8_decoder_ctx();


	this.getFrame = function () {

		do {
			isFrame = !read_frame(input, buf, buf_off, buf_sz, buf_alloc_sz);
			if (!isFrame) {
				return false;
			}
			buf = buf[0];

			vp8_dixie_decode_frame(decoderContext, buf, buf_sz);
			buf = [buf];

		} while (!decoderContext.frame_hdr.is_shown);

		return decoderContext.ref_frames[0].img;
	}

	this.setData = function(data) {
		console.dir(this);
		input.infile.data = data;
	}
}