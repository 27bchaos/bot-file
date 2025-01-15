import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { join } from 'path';
import ContinuousYouTubeStreamer from "./classes/ContinousStreamer";

const app = express();
const server = createServer(app);
const io = new Server(server);

// Create a single streamer instance
const streamer = new ContinuousYouTubeStreamer();

let broadcastQueueStatus = () => {
    io.emit('streamStatus', streamer.getQueueStatus());
}

// Serve static files
app.use(express.static(join(process.cwd(), 'public')));

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    // Send initial status
    socket.emit('streamStatus', streamer.getQueueStatus());

    // Handle start stream request
    socket.on('startStream', async ({ streamKey }) => {
        try {
            if (!streamKey) {
                throw new Error('Stream key is required');
            }
            
            // Set the stream key and start streaming
            streamer.setStreamKey(streamKey);
            await streamer.startStreaming();
            broadcastQueueStatus();
        } catch (error: any) {
            socket.emit('error', { message: error.message });
        }
    });

    // Handle stop stream request
    socket.on('stopStream', () => {
        streamer.stopStreaming();
        broadcastQueueStatus();
    });

    // Handle add video request
    socket.on('addVideo', async (video) => {
        try {
            await streamer.addToQueue([video]);
            broadcastQueueStatus();

            // Broadcast updates every second while downloading
            const updateInterval = setInterval(() => {
                broadcastQueueStatus();
            }, 1000);

            // Stop updates after 30 seconds (adjust as needed)
            setTimeout(() => {
                clearInterval(updateInterval);
                broadcastQueueStatus();
            }, 30000);

        } catch (error: any) {
            socket.emit('error', { message: error.message });
        }
    });

    // Handle remove video request
    socket.on('removeVideo', (index: number) => {
        try {
            streamer.removeFromQueue(index);
            broadcastQueueStatus();
        } catch (error: any) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
