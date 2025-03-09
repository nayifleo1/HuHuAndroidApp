import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { TorrentStreamModule } = NativeModules;

const CACHE_KEY = '@torrent_cache_mapping';

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
  private cachedTorrents: Map<string, string> = new Map(); // Map of magnet URI to cached file path
  private initialized: boolean = false;

  constructor() {
    // Create event emitter with supported methods
    this.eventEmitter = new NativeEventEmitter(TorrentStreamModule);
    this.loadCache();
  }

  private async loadCache() {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEY);
      if (cacheData) {
        const cacheMap = JSON.parse(cacheData);
        this.cachedTorrents = new Map(Object.entries(cacheMap));
        console.log('[TorrentService] Loaded cache mapping:', this.cachedTorrents);
      }
      this.initialized = true;
    } catch (error) {
      console.error('[TorrentService] Error loading cache:', error);
      this.initialized = true;
    }
  }

  private async saveCache() {
    try {
      const cacheData = Object.fromEntries(this.cachedTorrents);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log('[TorrentService] Saved cache mapping');
    } catch (error) {
      console.error('[TorrentService] Error saving cache:', error);
    }
  }

  public async startStream(magnetUri: string, events?: TorrentStreamEvents): Promise<string> {
    // Wait for cache to be loaded
    while (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
      // First check if we have this torrent cached
      const cachedPath = this.cachedTorrents.get(magnetUri);
      if (cachedPath) {
        console.log('[TorrentService] Found cached torrent file:', cachedPath);
        // Verify the file still exists
        const exists = await TorrentStreamModule.fileExists(cachedPath);
        if (exists) {
          console.log('[TorrentService] Using cached torrent file');
          
          // Even for cached files, we need to start the torrent stream to maintain the session
          // First stop any existing stream and wait a moment for cleanup
          await this.stopStreamAndWait();

          // Setup progress listener if callback provided
          if (events?.onProgress) {
            console.log('[TorrentService] Setting up progress listener for cached file');
            this.progressListener = this.eventEmitter.addListener(
              TorrentService.TORRENT_PROGRESS_EVENT,
              (progress) => {
                console.log('[TorrentService] Progress event received:', progress);
                if (events.onProgress) {
                  events.onProgress(progress);
                }
              }
            );
          }

          // Start the stream in cached mode
          await TorrentStreamModule.startStream(magnetUri);
          return cachedPath;
        } else {
          console.log('[TorrentService] Cached file not found, removing from cache');
          this.cachedTorrents.delete(magnetUri);
          await this.saveCache();
        }
      }

      // First stop any existing stream and wait a moment for cleanup
      await this.stopStreamAndWait();

      // Setup progress listener if callback provided
      if (events?.onProgress) {
        console.log('[TorrentService] Setting up progress listener');
        this.progressListener = this.eventEmitter.addListener(
          TorrentService.TORRENT_PROGRESS_EVENT,
          (progress) => {
            console.log('[TorrentService] Progress event received:', progress);
            
            // Update cache mapping if download is complete
            if (progress.progress >= 100) {
              console.log('[TorrentService] Download complete, adding to cache');
            }
            
            if (events.onProgress) {
              events.onProgress(progress);
            }
          }
        );
      } else {
        console.log('[TorrentService] No progress callback provided');
      }

      // Start the stream
      console.log('[TorrentService] Starting torrent stream');
      const filePath = await TorrentStreamModule.startStream(magnetUri);
      
      // Save to cache
      if (filePath) {
        console.log('[TorrentService] Adding path to cache:', filePath);
        this.cachedTorrents.set(magnetUri, filePath);
        await this.saveCache();
      }
      
      return filePath;
    } catch (error) {
      console.error('[TorrentService] Error starting torrent stream:', error);
      this.cleanup(); // Clean up on error
      throw error;
    }
  }

  public async stopStreamAndWait(): Promise<void> {
    console.log('[TorrentService] Stopping stream and waiting for cleanup');
    this.cleanup();
    try {
      TorrentStreamModule.stopStream();
      // Wait a moment to ensure native side has cleaned up
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('[TorrentService] Error stopping torrent stream:', error);
    }
  }

  public stopStream(): void {
    try {
      console.log('[TorrentService] Stopping stream and cleaning up');
      this.cleanup();
      TorrentStreamModule.stopStream();
    } catch (error) {
      console.error('[TorrentService] Error stopping torrent stream:', error);
      // Still attempt cleanup even if stop fails
      this.cleanup();
    }
  }

  private cleanup(): void {
    console.log('[TorrentService] Cleaning up event listeners');
    if (this.progressListener) {
      try {
        this.progressListener.remove();
      } catch (error) {
        console.error('[TorrentService] Error removing progress listener:', error);
      } finally {
        this.progressListener = null;
      }
    }
  }
}

export const torrentService = new TorrentService(); 