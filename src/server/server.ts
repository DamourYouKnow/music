import * as path from 'path';
import * as express from 'express';
import * as fs from 'fs';
import * as youtubedl from 'ytdl-core';
import * as bodyParser from 'body-parser';
import * as uuid from 'uuid';

const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../public')));

app.listen(port);
console.log(`Listening on http://localhost:${port}`);

class Room {
    id: string;
    queue: Track[];
    clients: Set<Client>; // Can't use Response type in generics?
    trackIdSet: Set<string>;

    constructor(id: string) {
        this.id = id;
        this.queue = [];
        this.clients = new Set();
        this.trackIdSet = new Set();
    }

    // Send new queue to all users in the room.
    notify() {
        this.clients.forEach((client) => {
            client.res.write(`data: ${JSON.stringify(this.roomJson())}\n\n`);
        });
    }

    roomJson() {
        return {
            users: this.clients.size,
            queue: this.queue
        };
    }
}

interface Track {
    id: string;
    title: string;
    length: number; // In milliseconds
    thumbnail?: string;
}

interface Client {
    req: express.Request;
    res: express.Response;
}

const rooms = new Map<string, Room>();
rooms.set('a', new Room('a')); // Manually creating a room for testing...
const streamPath = path.join(__dirname, '../../streams/');

// Request to create new room.
app.post('/room', (req, res) => {
    return;
});

app.get('/join/*', (req, res) => {
    const roomId = resource(req.path);
    const client: Client = {res: res, req: req};
    rooms.get(roomId).clients.add(client);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.flushHeaders();
    console.log('User joined');

    res.on('close', () => {
        console.log('User disconnected');
        res.end();
        rooms.get(roomId).clients.delete(client);
    });
});

// Request to queue song in a room. TODO: add room id to url.
app.post('/queue', (req, res) => {
    console.log(req.body);

    const room = rooms.get(req.body.room);
    if (!room) {
        res.sendStatus(400);
        return;
    }

    const enqueue = (track: Track) => {
        room.queue.push(track);
        room.notify();  
        res.sendStatus(200);
    };

    const videoUrl = req.body.url;
    if (!youtubedl.validateURL(videoUrl)) {
        res.status(400).send('Invalid URL');
        return;
    }

    if (room.queue.length > 100) {
        res.status(429).send('Room capacity reached');
        return;
    }

    const trackId = youtubedl.getVideoID(videoUrl);
    if (room.trackIdSet.has(trackId)) {
        res.status(409).send('Item already in queue');
        return;
    }

    room.trackIdSet.add(trackId);
    const video = youtubedl(trackId, {filter: 'audioonly'});
    let track: Track | null = null;
    video.on('info', (info) => {
        track = {
            id: trackId,
            title: info.videoDetails.title,
            length: Number(info.videoDetails.lengthSeconds),
            thumbnail: info.videoDetails.thumbnail.thumbnails[0].url,
        };
        video.pipe(fs.createWriteStream(streamPath + trackId + '.mp3'));
        console.log('Download started');
        console.log('filename: ' + track.title);
    });
    video.on('error', (err) => {
        console.error(err);
        fs.unlink(streamPath + trackId + '.mp3', (fsErr) => {
            console.error(fsErr);
        });
        room.trackIdSet.delete(trackId);
        res.sendStatus(500);
    });
    video.on('complete', (_) => {
        console.log('Download already complete');
        if (track) enqueue(track);
    });
    video.on('end', (_) => {
        console.log('Download complete');
        if (track) enqueue(track);
    });
});

// Request to get queue of a room.
app.get('/room/*', (req, res) => {
    const roomId = resource(req.path);
    const room = rooms.get(roomId);
    if (!room) {
        res.sendStatus(404);
        return;
    }
    res.json(room.roomJson());
});

// Request to get audio file location.
app.get('/track/*', (req, res) => {
    const trackFilename = resource(req.path);
    res.sendFile(streamPath + trackFilename);
});

function resource(path: string): string {
    const split = path.split('/');
    return split[split.length - 1] || '';
}
