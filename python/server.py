from flask import Flask, send_file, Response, jsonify, render_template_string, stream_with_context
import yt_dlp
import os
from urllib.parse import unquote
import re
from typing import Dict, Any, Optional
import io
import logging
import tempfile

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# HTML template remains the same as before
HTML_TEMPLATE = '''
<!DOCTYPE htssml>
<html>
<head>
    <title>YouTube Downloader</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { margin-top: 20px; }
        input[type="text"] { width: 70%; padding: 10px; }
        button { padding: 10px 20px; background: #ff0000; color: white; border: none; cursor: pointer; }
        #result { margin-top: 20px; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>YouTube Downloader</h1>
    <div class="container">
        <input type="text" id="videoUrl" placeholder="Enter YouTube URL">
        <button onclick="getInfo()">Get Info</button>
    </div>
    <div id="result"></div>

    <script>
        async function getInfo() {
            const url = document.getElementById('videoUrl').value;
            const result = document.getElementById('result');
            result.innerHTML = 'Loading...';
            
            try {
                const response = await fetch(`/info/${encodeURIComponent(url)}`);
                const data = await response.json();
                
                if (response.ok) {
                    result.innerHTML = `
                        <h3>${data.title}</h3>
                        <p>Duration: ${formatDuration(data.duration)}</p>
                        <p>Video ID: ${data.video_id}</p>
                        <button onclick="downloadVideo('${data.video_id}')">Download</button>
                        <button onclick="streamVideo('${data.video_id}')">Stream</button>
                    `;
                } else {
                    result.innerHTML = `<p class="error">Error: ${data.error}</p>`;
                }
            } catch (error) {
                result.innerHTML = `<p class="error">Error: ${error.message}</p>`;
            }
        }

        function formatDuration(seconds) {
            return new Date(seconds * 1000).toISOString().substr(11, 8);
        }

        function downloadVideo(videoId) {
            window.location.href = `/download/${videoId}`;
        }

        function streamVideo(videoId) {
            window.location.href = `/stream/${videoId}`;
        }
    </script>
</body>
</html>
'''

class VideoDownloader:
    def __init__(self):
        self.ydl_opts = {
            'format': 'best[ext=mp4]',  # Best MP4 format
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }
    
    def is_valid_youtube_url(self, url: str) -> bool:
        youtube_regex = r'^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$'
        return bool(re.match(youtube_regex, url))
    
    def get_video_info(self, url: str) -> Dict[str, Any]:
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    'title': info['title'],
                    'duration': info['duration'],
                    'video_id': info['id'],
                    'formats': info['formats']
                }
        except Exception as e:
            logger.error(f"Error getting video info: {str(e)}")
            raise Exception(f"Failed to get video info: {str(e)}")

    def download_video(self, url: str) -> tuple:
        try:
            temp_dir = tempfile.mkdtemp()
            temp_file = os.path.join(temp_dir, 'video.mp4')
            
            ydl_opts = {
                'format': 'best[ext=mp4]',
                'outtmpl': temp_file,
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                return temp_file, info['title']
                
        except Exception as e:
            logger.error(f"Error downloading video: {str(e)}")
            raise Exception(f"Failed to download video: {str(e)}")

# Initialize downloader
downloader = VideoDownloader()

@app.route('/')
def home():
    """Render the frontend interface."""
    return render_template_string(HTML_TEMPLATE)

@app.route('/info/<path:video_url>')
def get_info(video_url):
    """Get video information."""
    try:
        video_url = unquote(video_url)
        if not downloader.is_valid_youtube_url(video_url):
            return jsonify({'error': 'Invalid YouTube URL'}), 400
        
        info = downloader.get_video_info(video_url)
        return jsonify(info)
    except Exception as e:
        logger.error(f"Error in get_info: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/stream/<video_id>')
def stream_video(video_id):
    """Stream video content."""
    try:
        url = f'https://www.youtube.com/watch?v={video_id}'
        temp_file, _ = downloader.download_video(url)
        
        def generate():
            with open(temp_file, 'rb') as video_file:
                while True:
                    chunk = video_file.read(8192)
                    if not chunk:
                        break
                    yield chunk
            # Cleanup temp file after streaming
            os.unlink(temp_file)
            os.rmdir(os.path.dirname(temp_file))
            
        return Response(
            stream_with_context(generate()),
            content_type='video/mp4'
        )
    except Exception as e:
        logger.error(f"Error in stream_video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/download/<video_id>')
def download_video(video_id):
    """Download video file."""
    try:
        url = f'https://www.youtube.com/watch?v={video_id}'
        temp_file, title = downloader.download_video(url)
        
        def cleanup():
            os.unlink(temp_file)
            os.rmdir(os.path.dirname(temp_file))
            
        return send_file(
            temp_file,
            as_attachment=True,
            download_name=f"{title}.mp4",
            mimetype='video/mp4'
        )
    except Exception as e:
        logger.error(f"Error in download_video: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=3000)