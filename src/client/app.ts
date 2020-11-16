import axios from 'axios';
import { loadavg } from 'os';

import { QueueRequest, RoomJson } from '../shared/types';

let room = '';
let currTrackId: string | null = null;
let userId = '';

const audioStream = document.getElementById('audio-stream') as HTMLAudioElement;
audioStream.volume = 0.4;
if (!audioStream) throw Error('No audio stream element');

const listenBtn = document.getElementById('listen-btn');
listenBtn.onclick = () => {
    initRoom(room);
};

load();

const queueBtn = document.getElementById('queue-btn') as HTMLButtonElement;
queueBtn.onclick = async () => {
    const queueInput = document.getElementById(
        'queue-input'
    ) as HTMLInputElement;
    if (!queueInput) throw Error('No queue input element');
    const data: QueueRequest = {
        userId: userId,
        room: room, // Manually created room for testing...
        url: queueInput.value
    };
    await axios.post('/queue', data);
};

async function load() {
    room = location.pathname.slice(1);
    if (room) {
        try {
            await joinRoom(room);
        } catch {
            await createRoom();
        }
    } else {
        await createRoom();
    }
}

async function createRoom() {
    const res = await axios.post('/room');
    room = res.data.room;
    location.pathname = room;
}

async function joinRoom(room: string) {
    const res = await axios.post(`/join/${room}`);
    userId = res.data.userId;
    subscribe(room, userId);
    await initRoom(room);
}

function subscribe(room, userId) {
    const eventSource = new EventSource(`/subscribe/${room}?userId=${userId}`);
    eventSource.addEventListener('message', (message) => {
        const room = JSON.parse(message.data) as RoomJson;
        updateRoom(room);
    
        if (room.playing) {
            if (currTrackId == null || currTrackId != room.playing.id) {
                currTrackId = room.playing.id;
                audioStream.src = `/track/${room.playing.id}.mp3`;
                const now = document.getElementById('np');
                now.innerHTML = '';
                const thumbnail = document.createElement('img');
                thumbnail.src = room.playing.thumbnail;

                const info = document.createElement('p');
                info.textContent = `${room.playing.title}`;
                
                now.appendChild(info);
                now.appendChild(thumbnail);
            }
        }
        else {
            document.getElementById('np').innerHTML =
                '<p>Nothing is playing right now.</p>';
        }
        updatePlayer(room);
    });
}

async function initRoom(room: string) {
    const res = await axios.get(`/room/${room}`);
    updateRoom(res.data);
    updatePlayer(res.data);
}

function updatePlayer(room: RoomJson) {
    if (room.playing) {
        if (currTrackId == null || 
            (currTrackId != room.playing.id || audioStream.paused)) 
        {
            currTrackId = room.playing.id;
            audioStream.src = `/track/${room.playing.id}.mp3`;
            audioStream.currentTime = room.time;
            audioStream.play();
        }
    }
}

function updateRoom(room: RoomJson) {
    // Update queue interface.
    const queue = document.getElementById('queue');
    if (!queue) throw Error('No queue element');
    queue.innerHTML = '<h3>Current Queue: </h3>';
    for (const content of room.queue) {

        const item = document.createElement('div');

        const thumbnail = document.createElement('img');
        thumbnail.src = content.thumbnail;

        const info = document.createElement('span');
        const duration = timeStr(new Date(content.length * 1000)); 
        info.textContent = `${duration} - ${content.title}`;

        item.appendChild(thumbnail);
        item.appendChild(info);
        queue.appendChild(item);
    }
}

function timeStr(time: Date): string {
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}