import * as path from 'path';
import * as express from 'express';
import * as fs from 'fs';
import * as youtubedl from 'ytdl-core';
import * as bodyParser from 'body-parser';
import * as uuid from 'uuid';

import { Track, QueueRequest } from '../shared/types';

const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../public')));

app.listen(port);
console.log(`Listening on http://localhost:${port}`);

class Room {
    id: string;
    queue: Track[];
    playing: Track | null;
    clients: Map<string, Client | null>;
    timer?: NodeJS.Timeout;
    trackIdSet: Set<string>;

    constructor(id: string) {
        this.id = id;
        this.queue = [];
        this.clients = new Map();
        this.trackIdSet = new Set();
    }

    // Play next item in queue
    next() {
        const nextItem = this.queue[0];
        if (!nextItem) {
            this.playing = null;
            this.notify();
            return;
        }

        this.playing = nextItem;
        this.timer = setTimeout(() => {
            // Remove old content and play next item.
            this.queue.shift();
            this.next();
             fs.unlink(`${streamPath + nextItem.id}.mp3`, (fsErr) => {
                console.error(fsErr);
            });
        }, nextItem.length * 1000);

        this.notify();
    }

    skip() {
        if (this.timer) clearTimeout(this.timer);
        this.next();
    }

    // Send room state to all users in the room.
    notify() {
        Array.from(this.clients.values()).forEach((client) => {
            if (client) {
                client.res.write(
                    `data: ${JSON.stringify(this.roomJson())}\n\n`
                );
            }
        });
    }

    roomJson() {
        return {
            users: this.clients.size,
            playing: this.playing,
            queue: this.queue
        };
    }
}

interface Client {
    req: express.Request;
    res: express.Response;
}

const rooms = new Map<string, Room>();
const streamPath = path.join(__dirname, '../../streams/');

// Request to create new room.
app.post('/room', (req, res) => {
    const roomId = uuid.v4().slice(0, 8);
    rooms.set(roomId, new Room(roomId));
    res.json({room: roomId});
});

app.get('/subscribe/*', (req, res) => {
    const roomId = resource(req.path);
    const userId = req.query['userId'] as string;

    if (!userId) {
        res.sendStatus(401);
        return;
    }

    const room = rooms.get(roomId);
    if (!room) {
        res.sendStatus(404);
        return;
    } 

    const validUser = room.clients.has(userId);
    if (!validUser) {
        res.sendStatus(403);
        return;
    }

    const client: Client = {res: res, req: req};
    room.clients.set(userId, client);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.flushHeaders();
    console.log('User subscribed');

    res.on('close', () => {
        console.log('User disconnected');
        res.end();
        rooms.get(roomId).clients.delete(userId);
    });
});

app.post('/join/*', (req, res) => {
    const roomId = resource(req.path);
    const room = rooms.get(roomId);
    if (!room) {
        res.sendStatus(404);
        return;
    }

    const userId = uuid.v4();
    // The client value will be set on subscribe.
    room.clients.set(userId, null);
    res.json({userId: userId});
});

// Request to queue song in a room. TODO: add room id to url.
app.post('/queue', (req, res) => {
    console.log(req.body);

    const body = req.body as QueueRequest;
    const room = rooms.get(body.room);
    if (!room) {
        res.sendStatus(400);
        return;
    }
    if (!body.userId) {
        res.sendStatus(401);
        return;
    }
    if (!room.clients.has(body.userId)) {
        res.sendStatus(403);
        return;
    }

    const videoUrl = body.url;
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

    const enqueue = (track: Track) => {
        room.queue.push(track);
        if (!room.playing) {
            room.next();
        } else {
            room.notify();
        }
        res.sendStatus(200);
    };

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
        video.pipe(fs.createWriteStream(`${streamPath + trackId}.mp3`));
        console.log('Download started');
        console.log('filename: ' + track.title);
    });
    video.on('error', (err) => {
        console.error(err);
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

app.get('/*', (req, res) => {
    const roomId = req.path;
    if (roomId && !rooms.has(roomId.slice(1))) {
        res.sendStatus(404);
        return;
    }
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

function resource(path: string): string {
    const split = path.split('/');
    return split[split.length - 1] || '';
}
