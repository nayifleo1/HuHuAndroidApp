import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

const { TorrentStreamModule } = NativeModules;

export interface TorrentProgress {
  bufferProgress: number;
  downloadSpeed: number;
  progress: number;
  seeds: number;
}

export interface TorrentStreamEvents {
  onProgress?: (progress: TorrentProgress) => void;
}

class TorrentService {
  private eventEmitter: NativeEventEmitter;
  private progressListener: EmitterSubscription | null = null;
  private static TORRENT_PROGRESS_EVENT = TorrentStreamModule.TORRENT_PROGRESS_EVENT;

  constructor() {
    // Create event emitter with supported methods
    this.eventEmitter = new NativeEventEmitter(TorrentStreamModule);
  }

  public async startStream(magnetUri: string, events?: TorrentStreamEvents): Promise<string> {
    try {
      // Remove any existing listeners
      this.cleanup();

      // Setup progress listener if callback provided
      if (events?.onProgress) {
        this.progressListener = this.eventEmitter.addListener(
          TorrentService.TORRENT_PROGRESS_EVENT,
          events.onProgress
        );
      }

      // Start the stream
      return await TorrentStreamModule.startStream(magnetUri);
    } catch (error) {
      console.error('Error starting torrent stream:', error);
      this.cleanup(); // Clean up on error
      throw error;
    }
  }

  public stopStream(): void {
    try {
      this.cleanup();
      TorrentStreamModule.stopStream();
    } catch (error) {
      console.error('Error stopping torrent stream:', error);
      // Still attempt cleanup even if stop fails
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.progressListener) {
      try {
        this.progressListener.remove();
      } catch (error) {
        console.error('Error removing progress listener:', error);
      } finally {
        this.progressListener = null;
      }
    }
  }
}

export const torrentService = new TorrentService(); 