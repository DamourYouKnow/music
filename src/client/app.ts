import axios from 'axios';

import { Track, QueueRequest } from '../shared/types';

interface Room {
    playing: Track | null;
    queue: Track[];
}

const room = 'a';
let currTrackId: string | null = null;
let userId = '';

const audioStream = document.getElementById('audio-stream') as HTMLAudioElement;
audioStream.volume = 0.4;
if (!audioStream) throw Error('No audio stream element');

joinRoom(room);

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

async function joinRoom(room: string) {
    const res = await axios.post(`/join/${room}`);
    userId = res.data.userId;

    const eventSource = new EventSource(`/subscribe/${room}?userId=${userId}`);
    eventSource.addEventListener('message', (message) => {
        const room = JSON.parse(message.data) as Room;
        updateRoom(room);
    
        if (room.playing) {
            if (currTrackId == null || currTrackId != room.playing.id) {
                currTrackId = room.playing.id;
                audioStream.src = `/track/${room.playing.id}.mp3`;
                const now = document.getElementById('np')
                const thumbnail = document.createElement('img');
                thumbnail.src = room.playing.thumbnail;
                now.append(thumbnail);
            }
        }
    });

    await initRoom(room);
}

async function initRoom(room: string) {
    const res = await axios.get(`/room/${room}`);
    updateRoom(res.data);
}

function updateRoom(room: Room) {
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