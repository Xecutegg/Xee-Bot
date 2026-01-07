import { Client } from "youtubei";
import YTMusicAPI from "lite-ytmusic-api";

// Lazy initialization pattern with promise caching
let youtube = null;
let ytmusic = null;
let initializationPromise = null;
let isInitialized = false;

/**
 * Initialize YouTube Music API with singleton pattern and error handling
 * @returns {Promise<boolean>} Success status
 */
const initializeAPIs = async () => {
    if (initializationPromise) {
        return initializationPromise;
    }

    if (isInitialized) {
        return true;
    }

    initializationPromise = (async () => {
        try {
            // Initialize YouTube API (lightweight, no async needed)
            if (!youtube) {
                youtube = new Client();
            }

            // Initialize YouTube Music API
            if (!ytmusic) {
                ytmusic = new YTMusicAPI();
                await ytmusic.initialize();
                console.log("YouTube Music API initialized successfully");
            }

            isInitialized = true;
            return true;
        } catch (error) {
            console.error("Failed to initialize YouTube APIs:", error);
            // Reset state on failure
            ytmusic = null;
            youtube = null;
            isInitialized = false;
            throw error;
        } finally {
            initializationPromise = null;
        }
    })();

    return initializationPromise;
};

const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
};

/**
 * Check if maxresdefault thumbnail (1920x1080) exists for a video
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<boolean>} Whether HD thumbnail exists
 */
const checkHDThumbnail = async (videoId) => {
    try {
        const url = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
        const response = await fetch(url, { method: 'HEAD' });
        // YouTube returns 200 even for placeholder images, check content-length
        const contentLength = response.headers.get('content-length');
        // Placeholder images are typically small (~1-2KB), real HD thumbnails are larger
        return response.ok && contentLength && parseInt(contentLength) > 10000;
    } catch {
        return false;
    }
};

/**
 * Search YouTube Music with fallback to regular YouTube
 * Only returns videos with 1920x1080 thumbnails
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of video results with HD thumbnails
 */
const getYouTubeResults = async (query) => {
    // Input validation
    if (!query || typeof query !== "string" || query.trim().length === 0) {
        console.warn("Invalid query provided to getYouTubeResults");
        return [];
    }

    try {
        // Ensure APIs are initialized
        await initializeAPIs();

        let data;
        try {
            data = await ytmusic.searchSongs(query);
        } catch (e) {
            let results;
            try {
                results = await youtube.search(query, {
                    type: "video",
                });
            } catch (searchError) {
                console.error("YouTube search failed", searchError);
                return []; // Return empty array if search fails
            }

            data = results.items
                .filter((video) => !video.isLive && video.id) // Ensure video.id exists
                .map((video) => {
                    const videoId = video.id;
                    return {
                        videoId: video.id,
                        title: video.title || "Unknown Title",
                        artists: video.channel?.name || "Unknown Channel",
                        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                        duration: formatDuration(video.duration || 0),
                    };
                });
        }

        // Filter for only videos with HD (1920x1080) thumbnails
        const hdResults = [];
        for (const item of data) {
            const videoId = item.videoId;
            if (videoId) {
                const hasHD = await checkHDThumbnail(videoId);
                if (hasHD) {
                    item.thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
                    hdResults.push(item);
                }
            }
            // Limit to 10 HD results to avoid too many requests
            if (hdResults.length >= 10) break;
        }

        return hdResults;
    } catch (error) {
        console.error("YouTube search completely failed:", error);
        return [];
    }
};

export { getYouTubeResults };
