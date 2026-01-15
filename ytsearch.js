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
 * Search YouTube Music with fallback to regular YouTube
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of video results
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
                return [];
            }

            data = results.items
                .filter((video) => !video.isLive && video.id)
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

        // Return results immediately without HD checking (for speed)
        return data.slice(0, 25).map(item => ({
            ...item,
            thumbnail: `https://i.ytimg.com/vi/${item.videoId}/maxresdefault.jpg`
        }));
    } catch (error) {
        console.error("YouTube search completely failed:", error);
        return [];
    }
};

export { getYouTubeResults };
