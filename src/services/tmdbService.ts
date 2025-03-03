import axios from 'axios';

// TMDB API configuration
const API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0MzljNDc4YTc3MWYzNWMwNTAyMmY5ZmVhYmNjYTAxYyIsIm5iZiI6MTcwOTkxMTEzNS4xNCwic3ViIjoiNjVlYjJjNWYzODlkYTEwMTYyZDgyOWU0Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.gosBVl1wYUbePOeB9WieHn8bY9x938-GSGmlXZK_UVM';
const BASE_URL = 'https://api.themoviedb.org/3';

// Types for TMDB responses
export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string;
  vote_average: number;
  season_poster_path?: string | null;
}

export interface TMDBSeason {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  episodes: TMDBEpisode[];
  poster_path: string | null;
  air_date: string;
}

export interface TMDBShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    poster_path: string | null;
    air_date: string;
  }[];
}

export class TMDBService {
  private static instance: TMDBService;

  private constructor() {}

  static getInstance(): TMDBService {
    if (!TMDBService.instance) {
      TMDBService.instance = new TMDBService();
    }
    return TMDBService.instance;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Search for a TV show by name
   */
  async searchTVShow(query: string): Promise<TMDBShow[]> {
    try {
      const response = await axios.get(`${BASE_URL}/search/tv`, {
        headers: this.getHeaders(),
        params: {
          query,
          include_adult: false,
          language: 'en-US',
          page: 1,
        },
      });
      return response.data.results;
    } catch (error) {
      console.error('Failed to search TV show:', error);
      return [];
    }
  }

  /**
   * Get TV show details by TMDB ID
   */
  async getTVShowDetails(tmdbId: number): Promise<TMDBShow | null> {
    try {
      const response = await axios.get(`${BASE_URL}/tv/${tmdbId}`, {
        headers: this.getHeaders(),
        params: {
          language: 'en-US',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get TV show details:', error);
      return null;
    }
  }

  /**
   * Get season details including all episodes
   */
  async getSeasonDetails(tmdbId: number, seasonNumber: number): Promise<TMDBSeason | null> {
    try {
      const response = await axios.get(`${BASE_URL}/tv/${tmdbId}/season/${seasonNumber}`, {
        headers: this.getHeaders(),
        params: {
          language: 'en-US',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get season details:', error);
      return null;
    }
  }

  /**
   * Get episode details
   */
  async getEpisodeDetails(
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<TMDBEpisode | null> {
    try {
      const response = await axios.get(
        `${BASE_URL}/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`,
        {
          headers: this.getHeaders(),
          params: {
            language: 'en-US',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get episode details:', error);
      return null;
    }
  }

  /**
   * Extract TMDB ID from Stremio ID
   * Stremio IDs for series are typically in the format: tt1234567:1:1 (imdbId:season:episode)
   * or just tt1234567 for the series itself
   */
  extractTMDBIdFromStremioId(stremioId: string): number | null {
    // For now, we'll need to search by name since we don't have direct TMDB IDs
    // In a real implementation, you might want to use an external service to convert IMDB to TMDB IDs
    return null;
  }

  /**
   * Find TMDB ID by IMDB ID
   */
  async findTMDBIdByIMDB(imdbId: string): Promise<number | null> {
    try {
      // Extract the IMDB ID without season/episode info
      const baseImdbId = imdbId.split(':')[0];
      
      const response = await axios.get(`${BASE_URL}/find/${baseImdbId}`, {
        headers: this.getHeaders(),
        params: {
          external_source: 'imdb_id',
          language: 'en-US',
        },
      });
      
      // Check TV results first
      if (response.data.tv_results && response.data.tv_results.length > 0) {
        return response.data.tv_results[0].id;
      }
      
      // Check movie results as fallback
      if (response.data.movie_results && response.data.movie_results.length > 0) {
        return response.data.movie_results[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to find TMDB ID by IMDB ID:', error);
      return null;
    }
  }

  /**
   * Get image URL for TMDB images
   */
  getImageUrl(path: string | null, size: 'original' | 'w500' | 'w300' | 'w185' | 'profile' = 'original'): string | null {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  /**
   * Get all episodes for a TV show
   */
  async getAllEpisodes(tmdbId: number): Promise<{ [seasonNumber: number]: TMDBEpisode[] }> {
    try {
      // First get the show details to know how many seasons there are
      const showDetails = await this.getTVShowDetails(tmdbId);
      if (!showDetails) return {};

      const allEpisodes: { [seasonNumber: number]: TMDBEpisode[] } = {};
      
      // Get episodes for each season (in parallel)
      const seasonPromises = showDetails.seasons
        .filter(season => season.season_number > 0) // Filter out specials (season 0)
        .map(async season => {
          const seasonDetails = await this.getSeasonDetails(tmdbId, season.season_number);
          if (seasonDetails && seasonDetails.episodes) {
            allEpisodes[season.season_number] = seasonDetails.episodes;
          }
        });
      
      await Promise.all(seasonPromises);
      return allEpisodes;
    } catch (error) {
      console.error('Failed to get all episodes:', error);
      return {};
    }
  }

  /**
   * Get episode image URL with fallbacks
   */
  getEpisodeImageUrl(episode: TMDBEpisode, show: TMDBShow | null = null, size: 'original' | 'w500' | 'w300' | 'w185' = 'w300'): string | null {
    // Try episode still image first
    if (episode.still_path) {
      return this.getImageUrl(episode.still_path, size);
    }
    
    // Try season poster as fallback
    if (show && show.seasons) {
      const season = show.seasons.find(s => s.season_number === episode.season_number);
      if (season && season.poster_path) {
        return this.getImageUrl(season.poster_path, size);
      }
    }
    
    // Use show poster as last resort
    if (show && show.poster_path) {
      return this.getImageUrl(show.poster_path, size);
    }
    
    return null;
  }

  /**
   * Convert TMDB air date to a more readable format
   */
  formatAirDate(airDate: string | null): string {
    if (!airDate) return 'Unknown';
    
    try {
      const date = new Date(airDate);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return airDate;
    }
  }

  async getCredits(tmdbId: number, type: string) {
    try {
      const response = await axios.get(`${BASE_URL}/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}/credits`, {
        headers: this.getHeaders(),
        params: {
          language: 'en-US',
        },
      });
      return response.data.cast || [];
    } catch (error) {
      console.error('Failed to fetch credits:', error);
      return [];
    }
  }

  async getPersonDetails(personId: number) {
    try {
      const response = await axios.get(`${BASE_URL}/person/${personId}`, {
        headers: this.getHeaders(),
        params: {
          language: 'en-US',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch person details:', error);
      return null;
    }
  }
}

export const tmdbService = TMDBService.getInstance();
export default tmdbService; 