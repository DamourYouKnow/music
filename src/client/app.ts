import axios from 'axios';

import { Track } from '../shared/types';

interface Room {
    playing: Track | null;
    queue: Track[];
}

let currTrackId: string | null = null;

const audioStream = document.getElementById('audio-stream') as HTMLAudioElement;
if (!audioStream) throw Error('No audio stream element');


const eventSource = new EventSource('/join/a');
eventSource.addEventListener('message', (message) => {
    const room = JSON.parse(message.data) as Room;
    updateRoom(room);

    if (room.playing) {
        if (currTrackId == null || currTrackId != room.playing.id) {
            currTrackId = room.playing.id;
            audioStream.src = `/track/${room.playing.id}.mp3`;
        }
    }
});

initRoom();

const queueBtn = document.getElementById('queue-btn') as HTMLButtonElement;
queueBtn.onclick = async () => {
    const queueInput = document.getElementById(
        'queue-input'
    ) as HTMLInputElement;
    if (!queueInput) throw Error('No queue input element');
    const data = {
        room: 'a', // Manually created room for testing...
        url: queueInput.value
    };
    await axios.post('/queue', data);
};

async function initRoom() {
    const res = await axios.get('/room/a');
    updateRoom(res.data);
}

function updateRoom(room: Room) {
    // Update queue interface.
    const queue = document.getElementById('queue');
    if (!queue) throw Error('No queue element');
    queue.innerHTML = '';
    for (const content of room.queue) {
        const item = document.createElement('li');

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