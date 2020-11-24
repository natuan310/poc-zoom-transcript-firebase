// a tool use debug mobile device
var testTool = window.testTool;
// get meeting args from url
var tmpArgs = testTool.parseQuery();
var meetingConfig = {
  apiKey: tmpArgs.apiKey,
  meetingNumber: tmpArgs.mn,
  userName: (function () {
    if (tmpArgs.name) {
      try {
        return testTool.b64DecodeUnicode(tmpArgs.name);
      } catch (e) {
        return tmpArgs.name;
      }
    }
    return (
      "CDN#" +
      tmpArgs.version +
      "#" +
      testTool.detectOS() +
      "#" +
      testTool.getBrowserInfo()
    );
  })(),
  passWord: tmpArgs.pwd,
  leaveUrl: "/index.html",
  role: parseInt(tmpArgs.role, 10),
  userEmail: (function () {
    try {
      return testTool.b64DecodeUnicode(tmpArgs.email);
    } catch (e) {
      return tmpArgs.email;
    }
  })(),
  lang: tmpArgs.lang,
  signature: tmpArgs.signature || "",
  china: tmpArgs.china === "1",
};
if (testTool.isMobileDevice()) {
  vConsole = new VConsole();
}
console.log(JSON.stringify(ZoomMtg.checkSystemRequirements()));

function connectAudio() {
  var el = $('.join-audio-by-voip__join-btn')
  if (el.length) {
    console.log('connectAudio')
    console.log(el[0])

    el[0].addEventListener("click", function () {
      console.log('Start Streaming')
      streamAudio()
    })
  } else {
    setTimeout(connectAudio, 100)
  }
}

function streamAudio() {
  navigator.getUserMedia({
    audio: true
  }, function (stream) {
    console.log('Start streaming!')
    var userName = meetingConfig.userName
    var lang = meetingConfig.lang

    // Start RecordRTC to stream audio
    recordAudio = RecordRTC(stream, {
      type: 'audio',
      mimeType: 'audio/webm',
      sampleRate: 44100,
      recorderType: StereoAudioRecorder,
      numberOfAudioChannels: 1,
      timeSlice: 6000,
      desiredSampRate: 16000,

      // as soon as the stream is available
      ondataavailable: function (blob) {
        console.log('Sending data!')
        // making use of socket.io-stream for bi-directional
        // streaming, create a stream
        var stream = ss.createStream();
        // stream directly to server
        // it will be temp. stored locally
        ss(socket).emit('stream-transcribe', stream, {
          size: blob.size,
          'userName': userName,
          'lang': lang
        });
        // pipe the audio blob to the read stream
        ss.createBlobReadStream(blob).pipe(stream);
      }
    });
    recordAudio.startRecording();
  }, function (error) {
    console.error(JSON.stringify(error));
  });
}

function mutedStatus() {
  ZoomMtg.getCurrentUser({
    success: function (res){
      if (!res.result.currentUser.muted) {
        console.log(res.result.currentUser.muted);
        recordAudio.pauseRecording();
      } else {
        console.log(res.result.currentUser.muted);
        recordAudio.resumeRecording();
      }
    }
  });
}

(function () {
  // it's option if you want to change the WebSDK dependency link resources. setZoomJSLib must be run at first
  // ZoomMtg.setZoomJSLib("https://source.zoom.us/1.8.1/lib", "/av"); // CDN version defaul
  if (meetingConfig.china)
    ZoomMtg.setZoomJSLib("https://jssdk.zoomus.cn/1.8.1/lib", "/av"); // china cdn option
  ZoomMtg.preLoadWasm();
  ZoomMtg.prepareJssdk();

  function beginJoin(signature) {
    ZoomMtg.init({
      leaveUrl: meetingConfig.leaveUrl,
      webEndpoint: meetingConfig.webEndpoint,
      success: function () {
        console.log(meetingConfig);
        console.log("signature", signature);
        $.i18n.reload(meetingConfig.lang);
        ZoomMtg.join({
          meetingNumber: meetingConfig.meetingNumber,
          userName: meetingConfig.userName,
          signature: signature,
          apiKey: meetingConfig.apiKey,
          userEmail: meetingConfig.userEmail,
          passWord: meetingConfig.passWord,
          success: function (res) {
            console.log("join meeting success");
            console.log("get attendeelist");
            ZoomMtg.getAttendeeslist({});
            ZoomMtg.getCurrentUser({
              success: function (res) {
                console.log("success getCurrentUser", res.result.currentUser);
              },
            });

            // join-audio-by-voip__join-btn zm-btn--primary
            var joinAudio = $('.join-audio-container__btn')
            if (joinAudio && joinAudio[0]) {
              console.log('joinAudio[0]')
              console.log(joinAudio[0])

              joinAudio[0].addEventListener("click", function () {

                console.log('JOIN CLICK')
                // var connectAudio = $('.join-audio-by-voip__join-btn')[0]
                connectAudio()
              });
              joinAudio[0].addEventListener("click", mutedStatus);
            }


          },
          error: function (res) {
            console.log(res);
          },
        });
      },
      error: function (res) {
        console.log(res);
      },
    });

    ZoomMtg.inMeetingServiceListener('onUserJoin', function (data) {
      console.log('inMeetingServiceListener onUserJoin', data);
    });

    ZoomMtg.inMeetingServiceListener('onUserLeave', function (data) {
      console.log('inMeetingServiceListener onUserLeave', data);
    });

    ZoomMtg.inMeetingServiceListener('onUserIsInWaitingRoom', function (data) {
      console.log('inMeetingServiceListener onUserIsInWaitingRoom', data);
    });

    ZoomMtg.inMeetingServiceListener('onMeetingStatus', function (data) {
      console.log('inMeetingServiceListener onMeetingStatus', data);
    });
  }

  beginJoin(meetingConfig.signature);
})();


// Connect to socket server
const socket = io('https://transcript-server.herokuapp.com');

socket.on('server-send', (msg) => {
  console.log(msg);
  socket.emit('client-send', 'Joined Meeting')
});

// Receive transcript-translate results from server
const closedCaption = document.getElementById('closed-caption')
// const userName = document.getElementById('user-name')
// const transcript = document.getElementById('transcript')

// socket.on('transcript', function (data) {
//   if (data) {
//     closedCaption.visible = true;
//     console.log(`Transcript: ${data.transcript}`)
//     userName.innerHTML = data.name;
//     transcript.innerHTML = data.transcript;
//   }
// });

const translation = document.getElementById('translation')
socket.on('translate', function (data) {
  // console.log(`Receiving translation: ${data.translation}`)
  translation.innerHTML = data.translation;
  // console.log(`Japanese: ${data.tranlation}`)
  // console.log(`English : ${data.re_translation}`)
});
