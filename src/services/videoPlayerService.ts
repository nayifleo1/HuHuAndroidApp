import { NativeModules } from 'react-native';

const { VideoPlayerModule } = NativeModules;

export const VideoPlayerService = {
  playVideo: (url: string): Promise<boolean> => {
    return VideoPlayerModule.playVideo(url);
  }
};