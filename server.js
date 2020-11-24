const throng = require('throng')

const WORKERS = process.env.WEB_CONCURRENCY || 1
const PORT = process.env.PORT || 3000

throng({
    workers: WORKERS,
    lifetime: Infinity
}, start)


function start() {
    const crypto = require('crypto')
    const express = require('express')
    const app = express()

    app.use(express.static(__dirname + '/public'));


    app
        .get('/', index)
        .listen(PORT, onListen)

    function index(req, res, next) {
        res.render('index.html')
    }

    function onListen() {
        console.log('Listening on', PORT)
    }
}


require('dotenv').config();
const projectId = process.env.PROJECT_ID;
const apiKey = process.env.API_KEY;

// var languageCode = 'en-US';
let encoding = 'LINEAR16';

const singleUtterance = true;
const interimResults = false;
const sampleRateHertz = 16000;
const speechContexts = [
    {
        phrases: [
            'mail',
            'email'
        ],
        boost: 20.0
    }
]

// Google Cloud Speech service
const speech = require('@google-cloud/speech');

const express = require('express');
const socketIo = require('socket.io');
const ss = require('socket.io-stream');
const app = express();
const server = app.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});
const io = new socketIo.Server(server, { cors: { origin: '*' } });

var users = [];
var userSTTs = {};

io.on('connection', (socket) => {
    console.log(`Socket connected [id=${socket.id}]`);
    socket.emit('server-send', `Server connected [id=${socket.id}]`);

    // Get User Name and Language Code from client
    socket.on('user-data', (data) => {
        var userName = data.userName;
        var languageCode = data.lang;

        console.log(`${userName} joined meeting using ${languageCode}!`)

        users.push({
            'userName': userName,
            'lang': languageCode
        })

        if (!(languageCode in userSTTs)) {
            userSTT = setupSTT(languageCode)
            userSTTs[languageCode] = userSTT;
        }
        console.log(users)
        console.log(userSTTs)
    })

    // when the socket sends 'stream-transcribe' events
    // when using audio streaming
    ss(socket).on('stream-transcribe', function (stream, data) {
        console.log('Receiving stream!')
        var userName = data.userName
        var languageCode = data.lang

        if (languageCode === 'en-US') {
            let speechClient = userSTTs[languageCode].speechClient
            let requestSTT = userSTTs[languageCode].requestSTT

            if (speechClient && requestSTT) {
                console.log(`Using ${languageCode} Speech Client`)
            }
            // make a detectIntStream call
            transcribeAudioStream(stream, speechClient, requestSTT, async function (results) {
                let res = await eng2jap(userName, results['results'][0]['alternatives'][0].transcript);
                console.log("Sending translation")
                socket.emit('translate', res)
                socket.broadcast.emit('translate', res)
            });
        }
        else {
            let speechClient = userSTTs[languageCode].speechClient
            let requestSTT = userSTTs[languageCode].requestSTT

            if (speechClient && requestSTT) {
                console.log(`Using ${languageCode} Speech Client`)
            }
            // make a detectIntStream call
            transcribeAudioStream(stream, speechClient, requestSTT, async function (results) {
                let res = await jap2eng(userName, results['results'][0]['alternatives'][0].transcript);
                console.log("Sending translation")
                socket.emit('translate', res)
                socket.broadcast.emit('translate', res)
            });
        }
    });
});

/**
 * Setup Cloud STT Integration
 */
function setupSTT(languageCode) {
    // Creates a client
    var speechClient = new speech.SpeechClient()
    if (speechClient && languageCode) {
        console.log(`${languageCode} Speech Client Created`)
    }

    // Create the initial request object
    // When streaming, this is the first call you will
    // make, a request without the audio stream
    // which prepares Dialogflow in receiving audio
    // with a certain sampleRateHerz, encoding and languageCode
    // this needs to be in line with the audio settings
    // that are set in the client
    var requestSTT = {
        config: {
            sampleRateHertz: sampleRateHertz,
            encoding: encoding,
            languageCode: languageCode
        },
        interimResults: interimResults,
    }

    return {
        'speechClient': speechClient,
        'requestSTT': requestSTT
    }
}

/*
 * STT - Transcribe Speech on Audio Stream
 * @param audio stream
 * @param cb Callback function to execute with results
 */
async function transcribeAudioStream(audio, speechClient, requestSTT, cb) {
    const recognizeStream = speechClient.streamingRecognize(requestSTT)
        .on('data', function (data) {
            cb(data);
        })
        .on('error', (e) => {
            console.log(e);
        })
        .on('end', () => {
            console.log('on end');
        });

    audio.pipe(recognizeStream);
    audio.on('end', function () {
    });
};


// Imports the Google Cloud client library
const { Translate } = require('@google-cloud/translate').v2;

// Instantiates a client
const translate = new Translate({ projectId });

if (translate) {
    console.log("Translate Client Created")
}

// Function to translate Eng to Jap text
async function eng2jap(userName, sourceText) {
    // The target language
    const source_lang = 'en';
    const target_lang = 'ja';

    // Translates some text into Japanese
    var [translation] = await translate.translate(sourceText, target_lang);
    var [re_translation] = await translate.translate(translation, source_lang);

    translation = userName + ': ' + translation
    re_translation = userName + ': ' + re_translation

    return { translation, re_translation };
}


// Function to translate Jap to Eng text
async function jap2eng(userName, sourceText) {
    // The target language
    const source_lang = 'ja';
    const target_lang = 'en';

    // Translates some text into Japanese
    var [translation] = await translate.translate(sourceText, target_lang);
    var [re_translation] = await translate.translate(translation, source_lang);

    translation = userName + ': ' + translation
    re_translation = userName + ': ' + re_translation

    return { translation, re_translation };
}