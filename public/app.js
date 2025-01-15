const socket = io();

// DOM Elements
const streamStatus = document.getElementById('streamStatus');
const queueCount = document.getElementById('queueCount');
const startStreamBtn = document.getElementById('startStream');
const stopStreamBtn = document.getElementById('stopStream');
const addVideoForm = document.getElementById('addVideoForm');
const queueList = document.getElementById('queueList');

// Event Listeners
startStreamBtn.addEventListener('click', () => {
    const streamKey = document.getElementById('streamKey').value;
    if (!streamKey) {
        alert('Please enter your YouTube stream key');
        return;
    }
    socket.emit('startStream', { streamKey });
});

stopStreamBtn.addEventListener('click', () => {
    socket.emit('stopStream');
});

addVideoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const videoUrl = document.getElementById('videoUrl').value;
    const videoTitle = document.getElementById('videoTitle').value;

    if (!videoUrl) return;

    socket.emit('addVideo', { url: videoUrl, title: videoTitle });
    document.getElementById('videoUrl').value = '';
    document.getElementById('videoTitle').value = '';
});

// Socket Events
socket.on('streamStatus', (data) => {
    streamStatus.textContent = data.isStreaming ? 'Streaming' : 'Stopped';
    startStreamBtn.disabled = data.isStreaming;
    stopStreamBtn.disabled = !data.isStreaming;
    queueCount.textContent = data.totalVideos;

    // Update queue display
    if (data.queue) {
        updateQueueDisplay(data.queue);
    }
});

function getStatusColor(status) {
    switch (status) {
        case 'pending': return 'text-yellow-400';
        case 'downloading': return 'text-blue-400';
        case 'ready': return 'text-green-400';
        case 'error': return 'text-red-400';
        default: return 'text-gray-400';
    }
}

function updateQueueDisplay(queue) {
    queueList.innerHTML = '';
    queue.forEach((video, index) => {
        const item = document.createElement('div');
        item.className = 'queue-item bg-gray-700 rounded p-4 space-y-2';
        
        const statusClass = getStatusColor(video.downloadStatus);
        const progressBar = video.downloadStatus === 'downloading' ? 
            `<div class="w-full bg-gray-600 rounded-full h-2">
                <div class="bg-blue-500 rounded-full h-2" style="width: ${video.downloadProgress}%"></div>
            </div>` : '';

        item.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-semibold">${video.title || 'Untitled Video'}</p>
                    <p class="text-sm ${statusClass}">${video.downloadStatus || 'pending'}</p>
                </div>
                <button onclick="removeVideo(${index})" class="text-red-400 hover:text-red-300">
                    Remove
                </button>
            </div>
            ${progressBar}
        `;
        queueList.appendChild(item);
    });
}

socket.on('error', (error) => {
    alert(error.message);
});

function removeVideo(index) {
    socket.emit('removeVideo', index);
}
