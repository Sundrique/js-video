#! /bin/sh

SOURCE_FILE_NAME="trailer_iphone.m4v"
VIDEO_FILE_NAME="trailer_iphone.webm"
AUDIO_FILE_NAME="sound.m4a"
TMP_AUDIO_NAME="sound.wav"
FRAME_LENGTH=2048

#mkdir -p jpg

#ffmpeg -i "$SOURCE_FILE_NAME" -an -f image2 -sameq "jpg/image_%05d.jpg"

ffmpeg -y -i "$SOURCE_FILE_NAME" -threads 8 -f webm -vcodec libvpx -g 120 -level 216 -profile 0 -qmax 42 -qmin 10 -rc_buf_aggressivity 0.95 -vb 2M -an "$VIDEO_FILE_NAME"

ffmpeg -i "$SOURCE_FILE_NAME" -sameq "$TMP_AUDIO_NAME"

faac -o "$AUDIO_FILE_NAME" "$TMP_AUDIO_NAME"

FPS=$(ffprobe "$SOURCE_FILE_NAME" 2>&1 | grep Stream | grep Video | sed -E 's/^.+, ([0-9]+) fps.+$/\1/g')
WIDTH=$(ffprobe "$SOURCE_FILE_NAME" 2>&1 | grep Stream | grep Video | sed -E 's/^.+, ([0-9]+)x[0-9]+,.+$/\1/g')
HEIGHT=$(ffprobe "$SOURCE_FILE_NAME" 2>&1 | grep Stream | grep Video | sed -E 's/^.+, [0-9]+x([0-9]+),.+$/\1/g')

# Video duraion
H=$(ffprobe "$VIDEO_FILE_NAME" 2>&1 | grep Duration | sed -E 's/^.+: ([0-9]+):[0-9]+:[0-9.]+,.+$/\1/g')
M=$(ffprobe "$VIDEO_FILE_NAME" 2>&1 | grep Duration | sed -E 's/^.+: [0-9]+:([0-9]+):[0-9.]+,.+$/\1/g')
S=$(ffprobe "$VIDEO_FILE_NAME" 2>&1 | grep Duration | sed -E 's/^.+: [0-9]+:[0-9]+:([0-9]+)\.[0-9]+,.+$/\1/g')
MS=$(ffprobe "$VIDEO_FILE_NAME" 2>&1 | grep Duration | sed -E 's/^.+: [0-9]+:[0-9]+:[0-9]+\.([0-9]+),.+$/\1/g')
MS_COUNT=${#MS}
MS=$((MS * (10 ** (3 - MS_COUNT))))
VIDEO_DURATION=$(((H * 60 * 60 + M * 60 + S) * 1000 + MS))

# Audio duraion
H=$(ffprobe "$AUDIO_FILE_NAME" 2>&1 | grep Duration | sed -E 's/^.+: ([0-9]+):[0-9]+:[0-9.]+,.+$/\1/g')
M=$(ffprobe "$AUDIO_FILE_NAME" 2>&1 | grep Duration | sed -E 's/^.+: [0-9]+:([0-9]+):[0-9.]+,.+$/\1/g')
S=$(ffprobe "$AUDIO_FILE_NAME" 2>&1 | grep Duration | sed -E 's/^.+: [0-9]+:[0-9]+:([0-9]+)\.[0-9]+,.+$/\1/g')
MS=$(ffprobe "$AUDIO_FILE_NAME" 2>&1 | grep Duration | sed -E 's/^.+: [0-9]+:[0-9]+:[0-9]+\.([0-9]+),.+$/\1/g')
MS_COUNT=${#MS}
MS=$((MS * (10 ** (3 - MS_COUNT))))
AUDIO_DURATION=$(((H * 60 * 60 + M * 60 + S) * 1000 + MS))

BASE64_AUDIO=$(openssl base64 -in "$AUDIO_FILE_NAME" | tr -d '\n')
BASE64_VIDEO=$(openssl base64 -in "$VIDEO_FILE_NAME" | tr -d '\n')

#printf "var videoData = '$BASE64_VIDEO';" > video_data.js

rm "$TMP_AUDIO_NAME"
rm "$AUDIO_FILE_NAME"
rm "$VIDEO_FILE_NAME"

#FRAMES_COUNT=$(find jpg -type f -print| wc -l)
AUDIO_LENGTH=${#BASE64_AUDIO}
VIDEO_LENGTH=${#BASE64_VIDEO}

if ((("$VIDEO_LENGTH" % "$AUDIO_LENGTH") == "0")); then
	VIDEO_FRAMES_COUNT=$((VIDEO_LENGTH / AUDIO_LENGTH))
else
	VIDEO_FRAMES_COUNT=$((VIDEO_LENGTH / AUDIO_LENGTH + 1))
fi

if ((("$VIDEO_LENGTH" % ("$FRAME_LENGTH" * "$VIDEO_FRAMES_COUNT")) == "0")); then
	VIDEO_ITERATIONS=$((VIDEO_LENGTH / (AUDIO_LENGTH * VIDEO_FRAMES_COUNT)))
else
	VIDEO_ITERATIONS=$((VIDEO_LENGTH / (AUDIO_LENGTH * VIDEO_FRAMES_COUNT) + 1))
fi

if ((("$AUDIO_LENGTH" % "$FRAME_LENGTH") == "0")); then
	AUDIO_ITERATIONS=$((AUDIO_LENGTH / FRAME_LENGTH))
else
	AUDIO_ITERATIONS=$((AUDIO_LENGTH / FRAME_LENGTH + 1))
fi

if (("$VIDEO_ITERATIONS" > "$AUDIO_ITERATIONS")); then
	ITERATIONS=$VIDEO_ITERATIONS
else
	ITERATIONS=$AUDIO_ITERATIONS
fi

#if ((("$AUDIO_STRING_LENGTH" % "$FRAMES_COUNT") == "0")); then
#	FRAME_LENGTH=$((AUDIO_STRING_LENGTH / FRAMES_COUNT))
#else
#	FRAME_LENGTH=$((AUDIO_STRING_LENGTH / FRAMES_COUNT + 1))
#fi

#printf "" > video.html

#FILES=jpg/*.jpg

#POSITION=0
#AUDIO_POSITION=0
#VIDEO_POSITION=0
FRAME_TEMPLATE="<script type=\"text/javascript\">parent.postMessage('%s~~%s','http://js-video.dev');</script>"

printf "$FRAME_TEMPLATE" "metadata" "{\"fps\":\"$FPS\",\"width\":\"$WIDTH\",\"height\":\"$HEIGHT\",\"videoDuration\":\"$VIDEO_DURATION\",\"audioDuration\":\"$AUDIO_DURATION\"}" > video.html

i=0
while [ $i -lt $ITERATIONS ]; do
	AUDIO_POSITION=$((i * FRAME_LENGTH))
	if [ $AUDIO_POSITION -le $AUDIO_LENGTH ]; then
		#echo "audio $AUDIO_POSITION"
		AUDIO_FRAME=${BASE64_AUDIO:AUDIO_POSITION:FRAME_LENGTH}
		printf "$FRAME_TEMPLATE" "audio" "$AUDIO_FRAME" >> video.html
	fi

	j=0
	while [ $j -lt $VIDEO_FRAMES_COUNT ]; do
  		VIDEO_POSITION=$(((i * VIDEO_FRAMES_COUNT + j) * FRAME_LENGTH))
  		if [ $VIDEO_POSITION -le $VIDEO_LENGTH ]; then
  			#echo "video $VIDEO_POSITION"
			VIDEO_FRAME=${BASE64_VIDEO:VIDEO_POSITION:FRAME_LENGTH}
  			printf "$FRAME_TEMPLATE" "video" "$VIDEO_FRAME" >> video.html
		fi
		j=$[$j+1];
	done

	i=$[$i+1]
done

#for f in $FILES; do
	#jpegtran -optimize -progressive -outfile "$f" "$f";

	#imgmin "$f" "$f";

	#VIDEO_FRAME=$(openssl base64 -in $f | tr -d '\n')
	#printf "$FRAME_TEMPLATE" "video" "$VIDEO_FRAME" >> video.html

	#todo check end
	#AUDIO_FRAME=${BASE64_AUDIO:POSITION:FRAME_LENGTH}
	#printf "$FRAME_TEMPLATE" "audio" "$AUDIO_FRAME" >> video.html

	#POSITION=$((POSITION + FRAME_LENGTH))
#done



#gzip --best video.html