import axios from 'axios';

const mediaStream = new MediaStream();
const audioStream = document.getElementById('audio-stream') as HTMLAudioElement;
if (!audioStream) throw Error('No audio stream element');


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
    const response = await (await axios.get(`/queue/${data.room}`)).data;
    const track = response[0];
    if (track) {
        audioStream.src = `/track/${track.id}.mp3`;
    }
};
