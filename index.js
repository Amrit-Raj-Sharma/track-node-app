const express = require('express')
const trackRoute = express.Router()
const multer = require('multer')


const mongDb = require('mongodb')
const MongoClient = require('mongodb').MongoClient;
const { ObjectId } = require('mongoose')

const { Readable } = require('stream')

// const trackRouter = require('./routers/track')

const app = express()
const port = process.env.PORT || 3000


// Connect Mongo Driver to MongoDB

let db;
MongoClient.connect('mongodb://localhost/trackDB', (err, database) => {
    if(err){
        console.log('MongoDB Connection Error, Please make sure that mongodb is running');
        process.exit(1);
    }
    db =database;
});


app.use('/api/tracks', trackRoute);


// Get tracks
trackRoute.get('/:trackID', (req, res) => {
    try {
        var trackID = new ObjectId(req.params.trackID)
    } catch (error) {
        return res.status(400).json({ 'message': "Invalid trackID in URL parameter. Must be a single String of 12 bytes or a string of 24 Hex characters" });        
    }

    res.set('content-type', 'audio/mp3');
    res.set('accept-ranges', 'bytes')

    let bucket = new mongDb.GridFSBucket(db, {
        bucketName: 'tracks'
    });

    let downloadStream = bucket.openDownloadStream(trackID);

    downloadStream.on('data', (chunk) => {
        res.write(chunk);
    });

    downloadStream.on('error', () => {
        res.sendStatus(404);
    });

    downloadStream.on('end', () => {
        res.end();
    })
})

// Post track
trackRoute.post('/add', (req, res) => {
    const storage = multer.memoryStorage()
    const upload = multer({ storage: storage, limits: { fields: 1, fileSize: 6000000, files: 1, parts: 2 } });
    
    upload.single('track')(req, res, (err) => {
        if(err){
            return res.status(400).json({ message: "Upload Request validation Failed" });
        } else if(!req.body.name){
            return res.status(400).json({ message: "No track name in request body" });
        }

        let trackName = req.body.name;

        // convert buffer to Readable Stream
        const readableTrackStream = new Readable();
        readableTrackStream.push(req.file.buffer);
        readableTrackStream.push(null);

        let bucket = new mongDb.GridFSBucket(db, {
            bucketName: 'tracks'
        });

        let uploadStream = bucket.openDownloadStream(trackName);
        let id = uploadStream.id;
        readableTrackStream.pipe(uploadStream);

        uploadStream.on('error', () => {
            return res.status(500).json({ message: "Error uploading file" });
        });

        uploadStream.on('finish', () => {
            return res.status(201).json({ message: "File uploaded successfully, stored under Mongo ObjectID: " + id })
        });
    })
})


app.listen(port, () => {
    console.log('Server is started at ' + port)
})



