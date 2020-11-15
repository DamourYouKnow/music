import axios from 'axios';

const audioStream = document.getElementById('audio-stream') as HTMLAudioElement;
if (!audioStream) throw Error('No audio stream element');


const eventSource = new EventSource('/join/a');
eventSource.addEventListener('message', (message) => {
    const room = JSON.parse(message.data);

    // Update queue interface.
    const queue = document.getElementById('queue');
    if (!queue) throw Error('No queue element');
    queue.innerHTML = '';
    for (const content of room.queue) {
        const item = document.createElement('li');
        const duration = timeStr(new Date(content.length * 1000));
        item.textContent = `${duration} - ${content.title}`;
        queue.appendChild(item);
    }

    const track = room.queue[0];
    if (track) {
        audioStream.src = `/track/${track.id}.mp3`;
    }
});


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


function timeStr(time: Date): string {
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}