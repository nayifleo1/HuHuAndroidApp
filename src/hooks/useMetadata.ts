import { useState, useEffect, useCallback } from 'react';
import { StreamingContent } from '../services/catalogService';
import { catalogService } from '../services/catalogService';
import { stremioService } from '../services/stremioService';
import { tmdbService } from '../services/tmdbService';
import { cacheService } from '../services/cacheService';
import { Cast, Episode, GroupedEpisodes, GroupedStreams } from '../types/metadata';

interface UseMetadataProps {
  id: string;
  type: string;
}

interface UseMetadataReturn {
  metadata: StreamingContent | null;
  loading: boolean;
  error: string | null;
  cast: Cast[];
  loadingCast: boolean;
  episodes: Episode[];
  groupedEpisodes: GroupedEpisodes;
  selectedSeason: number;
  tmdbId: number | null;
  loadingSeasons: boolean;
  groupedStreams: GroupedStreams;
  loadingStreams: boolean;
  episodeStreams: GroupedStreams;
  loadingEpisodeStreams: boolean;
  preloadedStreams: GroupedStreams;
  preloadedEpisodeStreams: { [episodeId: string]: GroupedStreams };
  selectedEpisode: string | null;
  inLibrary: boolean;
  loadMetadata: () => Promise<void>;
  loadStreams: () => Promise<void>;
  loadEpisodeStreams: (episodeId: string) => Promise<void>;
  handleSeasonChange: (seasonNumber: number) => void;
  toggleLibrary: () => void;
  setSelectedEpisode: (episodeId: string | null) => void;
  setEpisodeStreams: (streams: GroupedStreams) => void;
}

export const useMetadata = ({ id, type }: UseMetadataProps): UseMetadataReturn => {
  const [metadata, setMetadata] = useState<StreamingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cast, setCast] = useState<Cast[]>([]);
  const [loadingCast, setLoadingCast] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [groupedEpisodes, setGroupedEpisodes] = useState<GroupedEpisodes>({});
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [groupedStreams, setGroupedStreams] = useState<GroupedStreams>({});
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [episodeStreams, setEpisodeStreams] = useState<GroupedStreams>({});
  const [loadingEpisodeStreams, setLoadingEpisodeStreams] = useState(false);
  const [preloadedStreams, setPreloadedStreams] = useState<GroupedStreams>({});
  const [preloadedEpisodeStreams, setPreloadedEpisodeStreams] = useState<{ [episodeId: string]: GroupedStreams }>({});
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [inLibrary, setInLibrary] = useState(false);

  const loadCast = async () => {
    try {
      setLoadingCast(true);
      const cachedCast = cacheService.getCast(id, type);
      if (cachedCast) {
        setCast(cachedCast);
        setLoadingCast(false);
        return;
      }

      const tmdbId = await tmdbService.findTMDBIdByIMDB(id);
      if (tmdbId) {
        const castData = await tmdbService.getCredits(tmdbId, type);
        if (castData) {
          setCast(castData);
          cacheService.setCast(id, type, castData);
        }
      }
    } catch (error) {
      console.error('Failed to load cast:', error);
    } finally {
      setLoadingCast(false);
    }
  };

  const loadMetadata = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check metadata screen cache
      const cachedScreen = cacheService.getMetadataScreen(id, type);
      if (cachedScreen) {
        setMetadata(cachedScreen.metadata);
        setCast(cachedScreen.cast);
        if (type === 'series' && cachedScreen.episodes) {
          setGroupedEpisodes(cachedScreen.episodes.groupedEpisodes);
          setEpisodes(cachedScreen.episodes.currentEpisodes);
          setSelectedSeason(cachedScreen.episodes.selectedSeason);
          setTmdbId(cachedScreen.tmdbId);
        }
        setLoading(false);
        return;
      }

      // Load content and cast
      const [content] = await Promise.all([
        catalogService.getContentDetails(type, id),
        loadCast()
      ]);

      if (content) {
        setMetadata(content);
        cacheService.setMetadata(id, type, content);

        if (type === 'series') {
          await loadSeriesData();
        }
      } else {
        setError('Content not found');
      }
    } catch (error) {
      console.error('Failed to load metadata:', error);
      setError('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const loadSeriesData = async () => {
    setLoadingSeasons(true);
    try {
      const tmdbIdResult = await tmdbService.findTMDBIdByIMDB(id);
      if (tmdbIdResult) {
        setTmdbId(tmdbIdResult);
        
        const [allEpisodes, showDetails] = await Promise.all([
          tmdbService.getAllEpisodes(tmdbIdResult),
          tmdbService.getTVShowDetails(tmdbIdResult)
        ]);
        
        const transformedEpisodes: GroupedEpisodes = {};
        Object.entries(allEpisodes).forEach(([season, episodes]) => {
          const seasonInfo = showDetails?.seasons?.find(s => s.season_number === parseInt(season));
          const seasonPosterPath = seasonInfo?.poster_path;
          
          transformedEpisodes[parseInt(season)] = episodes.map(episode => ({
            ...episode,
            episodeString: `S${episode.season_number.toString().padStart(2, '0')}E${episode.episode_number.toString().padStart(2, '0')}`,
            season_poster_path: seasonPosterPath || null
          }));
        });
        
        setGroupedEpisodes(transformedEpisodes);
        
        const firstSeason = Math.min(...Object.keys(allEpisodes).map(Number));
        const initialEpisodes = transformedEpisodes[firstSeason] || [];
        setSelectedSeason(firstSeason);
        setEpisodes(initialEpisodes);
      }
    } catch (error) {
      console.error('Failed to load episodes:', error);
    } finally {
      setLoadingSeasons(false);
    }
  };

  const loadStreams = async () => {
    try {
      console.log('🎬 Starting to load movie streams for:', id);
      setLoadingStreams(true);
      setError(null);

      // Initialize empty grouped streams
      const newGroupedStreams: GroupedStreams = {};

      // Start fetching Stremio streams
      console.log('🔍 Fetching Stremio streams...');
      const stremioResponses = await stremioService.getStreams(type, id);
      console.log('✅ Stremio streams response received:', stremioResponses.length, 'addons responded');
      
      // Group streams by addon
      stremioResponses.forEach(response => {
        const addonId = response.addon;
        if (addonId) {
          const streamsWithAddon = response.streams.map(stream => ({
            ...stream,
            name: stream.name || stream.title || 'Unnamed Stream',
            addonId: response.addon,
            addonName: response.addonName
          }));
          
          if (streamsWithAddon.length > 0) {
            newGroupedStreams[addonId] = {
              addonName: response.addonName,
              streams: streamsWithAddon
            };
          }
        }
      });

      // Get TMDB ID for external sources
      console.log('🔍 Getting TMDB ID for:', id);
      let tmdbId;
      if (id.startsWith('tmdb:')) {
        tmdbId = id.split(':')[1];
      } else if (id.startsWith('tt')) {
        // This is an IMDB ID
        console.log('📝 Converting IMDB ID to TMDB ID...');
        tmdbId = await tmdbService.findTMDBIdByIMDB(id);
        console.log('✅ Got TMDB ID:', tmdbId);
      } else {
        tmdbId = id;
      }

      if (!tmdbId) {
        console.error('❌ Could not get TMDB ID for:', id);
        throw new Error('Could not get TMDB ID');
      }

      // Fetch external sources in parallel
      console.log('🌐 Fetching external streams using TMDB ID:', tmdbId);
      const [source1Streams, source2Streams] = await Promise.all([
        fetchExternalStreams(
          `https://nice-month-production.up.railway.app/embedsu/${tmdbId}`,
          'Source 1'
        ),
        fetchExternalStreams(
          `https://vidsrc-api-js-phz6.onrender.com/embedsu/${tmdbId}`,
          'Source 2'
        )
      ]);

      if (source1Streams.length > 0) {
        newGroupedStreams['source_1'] = {
          addonName: 'Source 1',
          streams: source1Streams
        };
      }

      if (source2Streams.length > 0) {
        newGroupedStreams['source_2'] = {
          addonName: 'Source 2',
          streams: source2Streams
        };
      }

      // Sort streams by installed addon order
      const installedAddons = stremioService.getInstalledAddons();
      const sortedKeys = Object.keys(newGroupedStreams).sort((a, b) => {
        const indexA = installedAddons.findIndex(addon => addon.id === a);
        const indexB = installedAddons.findIndex(addon => addon.id === b);
        
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
      
      // Create a new object with the sorted keys
      const sortedStreams: GroupedStreams = {};
      sortedKeys.forEach(key => {
        sortedStreams[key] = newGroupedStreams[key];
      });

      setGroupedStreams(sortedStreams);
      setPreloadedStreams(sortedStreams);

      // Cache the streams
      cacheService.setStreams(id, type, sortedStreams);

    } catch (error) {
      console.error('Failed to load streams:', error);
      setError('Failed to load streams');
    } finally {
      setLoadingStreams(false);
    }
  };

  const loadEpisodeStreams = async (episodeId: string) => {
    try {
      console.log('🎬 Starting to load episode streams for:', episodeId);
      setLoadingEpisodeStreams(true);
      setError(null);

      // Initialize empty episode streams
      const newGroupedStreams: GroupedStreams = {};

      // Start fetching Stremio streams
      console.log('🔍 Fetching Stremio streams...');
      const stremioResponses = await stremioService.getStreams('series', episodeId);
      console.log('✅ Stremio streams response received:', stremioResponses.length, 'addons responded');
      
      // Group streams by addon
      stremioResponses.forEach(response => {
        const addonId = response.addon;
        if (addonId) {
          const streamsWithAddon = response.streams.map(stream => ({
            ...stream,
            name: stream.name || stream.title || 'Unnamed Stream',
            addonId: response.addon,
            addonName: response.addonName
          }));
          
          if (streamsWithAddon.length > 0) {
            newGroupedStreams[addonId] = {
              addonName: response.addonName,
              streams: streamsWithAddon
            };
          }
        }
      });

      // Get TMDB ID for external sources
      console.log('🔍 Getting TMDB ID for:', id);
      let tmdbId;
      if (id.startsWith('tmdb:')) {
        tmdbId = id.split(':')[1];
      } else if (id.startsWith('tt')) {
        // This is an IMDB ID
        console.log('📝 Converting IMDB ID to TMDB ID...');
        tmdbId = await tmdbService.findTMDBIdByIMDB(id);
        console.log('✅ Got TMDB ID:', tmdbId);
      } else {
        tmdbId = id;
      }

      if (!tmdbId) {
        console.error('❌ Could not get TMDB ID for:', id);
        throw new Error('Could not get TMDB ID');
      }

      // Extract episode info from the episodeId
      const [, season, episode] = episodeId.split(':');
      const episodeQuery = `?s=${season}&e=${episode}`;

      // Fetch external sources in parallel
      console.log('🌐 Fetching external streams using TMDB ID:', tmdbId);
      const [source1Streams, source2Streams] = await Promise.all([
        fetchExternalStreams(
          `https://nice-month-production.up.railway.app/embedsu/${tmdbId}${episodeQuery}`,
          'Source 1'
        ),
        fetchExternalStreams(
          `https://vidsrc-api-js-phz6.onrender.com/embedsu/${tmdbId}${episodeQuery}`,
          'Source 2'
        )
      ]);

      if (source1Streams.length > 0) {
        newGroupedStreams['source_1'] = {
          addonName: 'Source 1',
          streams: source1Streams
        };
      }

      if (source2Streams.length > 0) {
        newGroupedStreams['source_2'] = {
          addonName: 'Source 2',
          streams: source2Streams
        };
      }

      // Sort streams by installed addon order
      const installedAddons = stremioService.getInstalledAddons();
      const sortedKeys = Object.keys(newGroupedStreams).sort((a, b) => {
        const indexA = installedAddons.findIndex(addon => addon.id === a);
        const indexB = installedAddons.findIndex(addon => addon.id === b);
        
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
      
      // Create a new object with the sorted keys
      const sortedStreams: GroupedStreams = {};
      sortedKeys.forEach(key => {
        sortedStreams[key] = newGroupedStreams[key];
      });

      setEpisodeStreams(sortedStreams);
      setPreloadedEpisodeStreams(prev => ({
        ...prev,
        [episodeId]: sortedStreams
      }));

      // Cache the streams
      cacheService.setEpisodeStreams(id, type, episodeId, sortedStreams);

    } catch (error) {
      console.error('Failed to load episode streams:', error);
      setError('Failed to load episode streams');
    } finally {
      setLoadingEpisodeStreams(false);
    }
  };

  const fetchExternalStreams = async (url: string, sourceName: string) => {
    try {
      console.log(`\n🌐 [${sourceName}] Starting fetch request...`);
      console.log(`📍 URL: ${url}`);
      
      // Add proper headers to ensure we get JSON response
      const headers = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };
      console.log('📋 Request Headers:', headers);

      // Make the fetch request
      console.log(`⏳ [${sourceName}] Making fetch request...`);
      const response = await fetch(url, { headers });
      console.log(`✅ [${sourceName}] Response received`);
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
      console.log(`🔤 Content-Type:`, response.headers.get('content-type'));

      // Check if response is ok
      if (!response.ok) {
        console.error(`❌ [${sourceName}] HTTP error: ${response.status}`);
        console.error(`📝 Status Text: ${response.statusText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Try to parse JSON
      console.log(`📑 [${sourceName}] Reading response body...`);
      const text = await response.text();
      console.log(`📄 [${sourceName}] Response body (first 300 chars):`, text.substring(0, 300));
      
      let data;
      try {
        console.log(`🔄 [${sourceName}] Parsing JSON...`);
        data = JSON.parse(text);
        console.log(`✅ [${sourceName}] JSON parsed successfully`);
      } catch (e) {
        console.error(`❌ [${sourceName}] JSON parse error:`, e);
        console.error(`📝 [${sourceName}] Raw response:`, text.substring(0, 200));
        throw new Error('Invalid JSON response');
      }
      
      // Transform the response
      console.log(`🔄 [${sourceName}] Processing sources...`);
      if (data && data.sources && Array.isArray(data.sources)) {
        console.log(`📦 [${sourceName}] Found ${data.sources.length} source(s)`);
        
        const transformedStreams = [];
        for (const source of data.sources) {
          console.log(`\n📂 [${sourceName}] Processing source:`, source);
          
          if (source.files && Array.isArray(source.files)) {
            console.log(`📁 [${sourceName}] Found ${source.files.length} file(s) in source`);
            
            for (const file of source.files) {
              console.log(`🎥 [${sourceName}] Processing file:`, file);
              const stream = {
                url: file.file,
                title: `${sourceName} - ${file.quality || 'Unknown'}`,
                name: `${sourceName} - ${file.quality || 'Unknown'}`,
                behaviorHints: {
                  notWebReady: false,
                  headers: source.headers || {}
                }
              };
              console.log(`✨ [${sourceName}] Created stream:`, stream);
              transformedStreams.push(stream);
            }
          } else {
            console.log(`⚠️ [${sourceName}] No files array found in source or invalid format`);
          }
        }
        
        console.log(`\n🎉 [${sourceName}] Successfully processed ${transformedStreams.length} stream(s)`);
        return transformedStreams;
      }
      
      console.log(`⚠️ [${sourceName}] No valid sources found in response`);
      return [];
    } catch (error) {
      console.error(`\n❌ [${sourceName}] Error fetching streams:`, error);
      console.error(`📍 URL: ${url}`);
      if (error instanceof Error) {
        console.error(`💥 Error name: ${error.name}`);
        console.error(`💥 Error message: ${error.message}`);
        console.error(`💥 Stack trace: ${error.stack}`);
      }
      return [];
    }
  };

  const handleSeasonChange = useCallback((seasonNumber: number) => {
    if (selectedSeason === seasonNumber) return;
    setSelectedSeason(seasonNumber);
    setEpisodes(groupedEpisodes[seasonNumber] || []);
  }, [selectedSeason, groupedEpisodes]);

  const toggleLibrary = useCallback(() => {
    if (!metadata) return;
    
    if (inLibrary) {
      catalogService.removeFromLibrary(type, id);
    } else {
      catalogService.addToLibrary(metadata);
    }
    
    setInLibrary(!inLibrary);
  }, [metadata, inLibrary, type, id]);

  useEffect(() => {
    loadMetadata();
  }, [id, type]);

  return {
    metadata,
    loading,
    error,
    cast,
    loadingCast,
    episodes,
    groupedEpisodes,
    selectedSeason,
    tmdbId,
    loadingSeasons,
    groupedStreams,
    loadingStreams,
    episodeStreams,
    loadingEpisodeStreams,
    preloadedStreams,
    preloadedEpisodeStreams,
    selectedEpisode,
    inLibrary,
    loadMetadata,
    loadStreams,
    loadEpisodeStreams,
    handleSeasonChange,
    toggleLibrary,
    setSelectedEpisode,
    setEpisodeStreams
  };
}; 