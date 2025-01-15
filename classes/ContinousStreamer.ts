import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

interface VideoQueue {
  url: string;
  title?: string;
  downloadStatus?: 'pending' | 'downloading' | 'ready' | 'error';
  downloadProgress?: number;
  localPath?: string;
}

interface VideoFormat {
  url: string;
  mimeType: string;
  quality?: string;
  hasAudio: boolean;
  size: number;
}

interface VideoDetails {
  status: boolean;
  id: string;
  title: string;
  description: string;
  lengthSeconds: number;
  videos: {
    items: VideoFormat[];
  };
  audios: {
    items: VideoFormat[];
  };
}

class ContinuousYouTubeStreamer {
  private streamKey: string | null;
  private channelId: string | null;
  private ffmpeg: any;
  private videoQueue: VideoQueue[];
  private tempDir: string;
  private isStreaming: boolean;
  private readonly rapidApiKey = '9bbd63a244msh775726887ed1838p17724fjsn6a3fd77c9ff1';
  private readonly rapidApiHost = 'youtube-media-downloader.p.rapidapi.com';

  constructor() {
    this.streamKey = null;
    this.channelId = null;
    this.videoQueue = [];
    this.isStreaming = false;
    this.tempDir = path.join(process.cwd(), 'downloads');

    this.initTempDir();
  }

  private async initTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.tempDir, file)).catch(() => {}))
      );
    } catch (error) {
      console.error('Error managing temp directory:', error);
      throw new Error('Failed to initialize temp directory');
    }
  }

  private async getVideoDetails(videoId: string): Promise<VideoDetails> {
    const options = {
      method: 'GET',
      url: `https://youtube-media-downloader.p.rapidapi.com/v2/video/details`,
      params: { videoId },
      headers: {
        'x-rapidapi-key': this.rapidApiKey,
        'x-rapidapi-host': this.rapidApiHost
      }
    };

    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      console.error('Error fetching video details:', error);
      throw error;
    }
  }

  private extractVideoId(url: string): string {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    if (!match) throw new Error('Invalid YouTube URL');
    return match[1];
  }

  private getBestFormat(formats: VideoFormat[]): VideoFormat {
    const mp4Formats = formats.filter(f => 
      f.mimeType.includes('video/mp4') && f.hasAudio
    );

    if (mp4Formats.length === 0) {
      throw new Error('No suitable video format found');
    }

    return mp4Formats.sort((a, b) => {
      const qualityA = parseInt(a.quality?.replace('p', '') || '0');
      const qualityB = parseInt(b.quality?.replace('p', '') || '0');
      return qualityB - qualityA;
    })[0];
  }

  async addToQueue(videos: VideoQueue[]) {
    for (const video of videos) {
      try {
        const videoId = this.extractVideoId(video.url);
        const details = await this.getVideoDetails(videoId);
        const bestFormat = this.getBestFormat(details.videos.items);

        const queueItem: VideoQueue = {
          url: bestFormat.url,
          title: video.title || details.title,
          downloadStatus: 'pending',
          downloadProgress: 0
        };

        this.videoQueue.push(queueItem);
        console.log(`Added video to queue: ${queueItem.title}`);

        // Start downloading immediately
        this.downloadVideo(bestFormat.url, this.videoQueue.length - 1)
          .then((localPath) => {
            queueItem.localPath = localPath;
            queueItem.downloadStatus = 'ready';
            queueItem.downloadProgress = 100;
          })
          .catch((error) => {
            console.error(`Error downloading video: ${error.message}`);
            queueItem.downloadStatus = 'error';
          });

      } catch (error) {
        console.error(`Error adding video to queue: ${video.url}`, error);
      }
    }

    if (this.isStreaming) {
      this.updateConcatenatedFile().catch((error) =>
        console.error('Error updating concatenated file:', error)
      );
    }
  }

  private async downloadVideo(url: string, index: number): Promise<string> {
    const outputPath = path.join(this.tempDir, `video_${index}.mp4`);

    try {
      const videoExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      
      if (videoExists) {
        console.log(`Video [${index}] already downloaded.`);
        return outputPath;
      }

      console.log(`Downloading video [${index}] from ${url}...`);
      
      const videoResponse = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
        maxRedirects: 5
      });

      if (!videoResponse.data) {
        throw new Error('No data received from download server');
      }

      await fs.writeFile(outputPath, videoResponse.data);
      console.log(`Downloaded video [${index}] to ${outputPath}`);
      return outputPath;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Network error downloading video [${index}]:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          headers: error.response?.headers
        });
      }
      console.error(`Failed to download video [${index}]:`, error);
      throw error;
    }
  }

  private async updateConcatenatedFile() {
    const fileListPath = path.join(this.tempDir, 'file_list.txt');
    const concatenatedVideoPath = path.join(this.tempDir, 'concatenated.mp4');

    try {
      const downloadPromises = this.videoQueue.map((video, index) => 
        this.downloadVideo(video.url, index)
      );
      await Promise.all(downloadPromises);

      const fileList = this.videoQueue
        .map((_, index) => `file 'video_${index}.mp4'`)
        .join('\n');
      await fs.writeFile(fileListPath, fileList);

      console.log('Concatenating videos...');
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-f', 'concat',
          '-safe', '0',
          '-i', fileListPath,
          '-c', 'copy',
          concatenatedVideoPath,
        ]);

        ffmpeg.stderr.on('data', (data: Buffer) => {
          console.log(`FFmpeg: ${data.toString()}`);
        });

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log('Videos concatenated successfully.');
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      console.error('Error during video concatenation:', error);
    }
  }

  public setStreamKey(streamKey: string, channelId: string) {
    if (!streamKey) {
      throw new Error('Stream key cannot be empty');
    }
    if (!channelId) {
      throw new Error('Channel ID cannot be empty');
    }
    this.streamKey = streamKey;
    this.channelId = channelId;
  }

  public getLiveStreamUrl(): string | null {
    if (!this.channelId || !this.isStreaming) {
      return null;
    }
    return `https://www.youtube.com/channel/${this.channelId}/live`;
  }

  public async startStreaming() {
    if (!this.streamKey) {
      throw new Error('Stream key is required to start streaming');
    }
    
    if (this.isStreaming) {
      throw new Error('Already streaming');
    }

    this.isStreaming = true;
    await this.updateConcatenatedFile();
    this.startFFmpegStream();
  }

  private startFFmpegStream() {
    if (!this.streamKey) {
      throw new Error('Stream key is required to start streaming');
    }
    const youtubeUrl = `rtmp://a.rtmp.youtube.com/live2/${this.streamKey}`;
    const concatenatedVideoPath = path.join(this.tempDir, 'concatenated.mp4');

    console.log('Starting stream...');
    this.ffmpeg = spawn('ffmpeg', [
      '-re',
      '-i', concatenatedVideoPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', '3500k',
      '-maxrate', '3500k',
      '-bufsize', '7000k',
      '-pix_fmt', 'yuv420p',
      '-g', '60',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-ar', '44100',
      '-f', 'flv',
      youtubeUrl,
    ]);

    this.ffmpeg.stderr.on('data', (data: Buffer) => {
      console.log(`FFmpeg: ${data.toString()}`);
    });

    this.ffmpeg.on('close', (code: number) => {
      console.log(`FFmpeg process closed with code ${code}`);
    });
  }

  stopStreaming() {
    this.isStreaming = false;
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGINT');
      this.ffmpeg = null;
    }
  }

  removeFromQueue(index: number) {
    if (index >= 0 && index < this.videoQueue.length) {
      // If the video has a local file, try to delete it
      const video = this.videoQueue[index];
      if (video.localPath) {
        fs.unlink(video.localPath).catch(err => 
          console.error(`Error deleting file ${video.localPath}:`, err)
        );
      }
      
      // Remove the video from the queue
      this.videoQueue.splice(index, 1);
      
      // Update concatenated file if streaming
      if (this.isStreaming) {
        this.updateConcatenatedFile().catch(error => 
          console.error('Error updating concatenated file:', error)
        );
      }
    }
  }

  getQueueStatus() {
    return {
      totalVideos: this.videoQueue.length,
      isStreaming: this.isStreaming,
      queue: this.videoQueue.map(video => ({
        title: video.title,
        url: video.url,
        downloadStatus: video.downloadStatus,
        downloadProgress: video.downloadProgress
      })),
      liveStreamUrl: this.getLiveStreamUrl()
    };
  }
}

export default ContinuousYouTubeStreamer;
