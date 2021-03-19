var express = require("express");
const path = require("path");
const fileUpload = require('express-fileupload');
const fs = require('fs');
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const ffmpeg = require('ffmpeg');
var app = express();
const { v4: uuidv4 } = require('uuid');

const fileSizeMB = 20
const limits = { fileSize: 1024 * 1024 * fileSizeMB } // File size in bytes

const translations = {};

app.use(fileUpload({
    limits: limits,
}),
    express.static(path.join(__dirname, "")));

const msSpeechSubscriptionKey = "<subscription-id>";
const msSpeecSubscriptionRegion = "<region>";
const speechConfig = sdk.SpeechConfig.fromSubscription(msSpeechSubscriptionKey, msSpeecSubscriptionRegion);

function fromFile(fname, languageCode, uuid) {
    translations[uuid] = { text: "", done: false };

    let pushStream = sdk.AudioInputStream.createPushStream();

    fs.createReadStream(fname).on('data', function (arrayBuffer) {
        pushStream.write(arrayBuffer.slice());
    }).on('end', function () {
        pushStream.close();
    });

    speechConfig.speechRecognitionLanguage = languageCode;

    // TODO: File format is very important. By default, it only works with 8/16 kHz mono WAV/PCM files
    // Example ffmpeg conversion that will work:
    //  ffmpeg -i file.wav -ar 16000 -ac 1 -f s16le file.raw
    let audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    let recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (s, e) => {
        //console.log(`RECOGNIZING: Text=${e.result.text}`);
    };

    recognizer.recognized = (s, e) => {
        if (e.result.reason == sdk.ResultReason.RecognizedSpeech) {
            translations[uuid].text += " " + e.result.text;
            console.log(`RECOGNIZED: Text=${e.result.text}`);
        }
        else if (e.result.reason == sdk.ResultReason.NoMatch) {

            console.log("NOMATCH: Speech could not be recognized.");
            console.log(e.result.errorDetails);
        }
    };

    recognizer.canceled = (s, e) => {
        console.log(`CANCELED: Reason=${e.reason}`);

        if (e.reason == sdk.CancellationReason.Error) {
            console.log(`"CANCELED: ErrorCode=${e.errorCode}`);
            console.log(`"CANCELED: ErrorDetails=${e.errorDetails}`);
            console.log("CANCELED: Did you update the subscription info?");
        }

        recognizer.stopContinuousRecognitionAsync();
    };

    recognizer.sessionStopped = (s, e) => {
        console.log("\n    Session stopped event.");
        translations[uuid].done = true;
    };

    recognizer.startContinuousRecognitionAsync();
}


app.get('/', function (req, res) {
    res.sendFile(__dirname + "/index.html");
});

function getUniqueID() {
    return uuidv4();
}

app.get('/fetch/:id', function (req, res) {
    const uuid = req.params.id;
    if (uuid in translations) {
        res.send(translations[uuid]);
    } else {
        res.send("Waiting..");
    }
});

// Defaults to US English (en-US)
function getLanguageCode(body) {
    let languageCode = "en-US";
    if (body && body.language) {
        languageCode = body.language;
    }
    return languageCode;
}

app.post('/upload', function (req, res) {
    if (!req.files || Object.keys(req.files).length === 0) {
        res.status(400).send('No files were uploaded.');
        return;
    }

    const languageCode = getLanguageCode(req.body);

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let sampleFile = req.files.sampleFile;
    console.log(sampleFile);
    const fname = Date.now() + "-" + sampleFile.name.replace(/\s/g, '');
    const fullPathOriginal = path.join(__dirname, `./uploads/${fname}`);
    const fullPathRaw = path.join(__dirname, `./uploads/${fname}.raw`);
    // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(fullPathOriginal, function (err) {
        if (err)
            res.status(500).send(err);
        else {
            try {
                const convertedFile = new ffmpeg(fullPathOriginal);
                convertedFile.then(function (video) {
                    // Based on this ffmpeg command:
                    //  ffmpeg -i file.wav -ar 16000 -ac 1 -f s16le file.raw
                    // Audio channels: 1
                    video.addCommand("-ac", "1")
                    // Audio rate: 16kHz
                    video.addCommand("-ar", "16000");
                    // Signed 16-bit, little endian
                    video.addCommand("-f", "s16le");
                    video.save(fullPathRaw, function (error, file) {
                        if (error) {
                            console.log(error);
                            res.status(500).send(error);
                        }
                        else {
                            const uuid = getUniqueID();
                            fromFile(fullPathRaw, languageCode, uuid);
                            res.send(uuid);
                        }
                    });
                },
                    function (err) {
                        console.log("IT WAS AN ERROR");
                        res.status(500).send(err);
                    });
            } catch (err) {
                console.log("ERRROR");
                res.status(500).send(err);
            }
        }
    });
});

app.get('/env', function (req, res) {
    res.send(JSON.stringify(process.env));
});


app.listen(3000, function () {
    console.log("Working on port 3000");
});