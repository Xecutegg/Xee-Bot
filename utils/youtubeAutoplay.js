import { Client } from "youtubei";
import { getYouTubeResults } from "../ytsearch.js";

// Initialize YouTube client
const youtube = new Client();

/**
 * Fetch up-next/related videos from YouTube for autoplay
 * @param {string} videoId - YouTube video ID
 * @param {object} requester - User object who requested the track
 * @param {number} limit - Maximum number of tracks to fetch (default: 10)
 * @returns {Promise<Array>} - Array of track objects
 */
export async function getUpNext(videoId, requester, limit = 10) {
    try {
        if (!videoId) return [];

        const allTracks = [];
        const processedIds = new Set([videoId]);

        // Method 1: Try to get related videos using youtubei
        try {
            const video = await youtube.getVideo(videoId);

            if (video && video.related) {
                const relatedVideos = video.related.items || [];

                for (const relatedVideo of relatedVideos) {
                    if (allTracks.length >= limit) break;

                    if (!relatedVideo.id || processedIds.has(relatedVideo.id)) continue;
                    if (relatedVideo.isLive) continue; // Skip live streams

                    processedIds.add(relatedVideo.id);

                    // Parse duration
                    let duration = 0;
                    if (relatedVideo.duration) {
                        duration = relatedVideo.duration * 1000; // Convert to milliseconds
                    }

                    allTracks.push({
                        track: `youtube:${relatedVideo.id}`,
                        info: {
                            identifier: relatedVideo.id,
                            title: relatedVideo.title || 'Unknown Title',
                            author: relatedVideo.channel?.name || 'Unknown Artist',
                            length: duration,
                            uri: `https://www.youtube.com/watch?v=${relatedVideo.id}`,
                            artworkUrl: `https://i.ytimg.com/vi/${relatedVideo.id}/maxresdefault.jpg`,
                            thumbnail: `https://i.ytimg.com/vi/${relatedVideo.id}/maxresdefault.jpg`,
                            sourceName: 'youtube',
                            requester: requester
                        },
                        autoplay: true,
                        requester: requester
                    });
                }
            }
        } catch (apiError) {
            console.error('YouTube API related videos failed:', apiError.message);
        }

        // Method 2: If we don't have enough tracks, search for similar content
        if (allTracks.length < limit) {
            try {
                // Get the original video info for search query
                const video = await youtube.getVideo(videoId);
                const searchQuery = video?.title || '';

                if (searchQuery) {
                    // Extract main keywords (remove common words like "official", "video", etc.)
                    const cleanQuery = searchQuery
                        .replace(/\(.*?\)/g, '') // Remove parentheses content
                        .replace(/\[.*?\]/g, '') // Remove brackets content
                        .replace(/official|video|audio|lyrics|hd|4k|music/gi, '')
                        .trim();

                    const searchResults = await getYouTubeResults(cleanQuery);

                    for (const result of searchResults) {
                        if (allTracks.length >= limit) break;

                        const resultId = result.videoId;
                        if (!resultId || processedIds.has(resultId)) continue;

                        processedIds.add(resultId);

                        // Parse duration from string format (mm:ss)
                        let duration = 0;
                        if (result.duration) {
                            const parts = result.duration.split(':').map(Number);
                            if (parts.length === 2) {
                                duration = (parts[0] * 60 + parts[1]) * 1000;
                            } else if (parts.length === 3) {
                                duration = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
                            }
                        }

                        allTracks.push({
                            track: `youtube:${resultId}`,
                            info: {
                                identifier: resultId,
                                title: result.title || 'Unknown Title',
                                author: result.artists || 'Unknown Artist',
                                length: duration,
                                uri: `https://www.youtube.com/watch?v=${resultId}`,
                                artworkUrl: result.thumbnail || `https://i.ytimg.com/vi/${resultId}/maxresdefault.jpg`,
                                thumbnail: result.thumbnail || `https://i.ytimg.com/vi/${resultId}/maxresdefault.jpg`,
                                sourceName: 'youtube',
                                requester: requester
                            },
                            autoplay: true,
                            requester: requester
                        });
                    }
                }
            } catch (searchError) {
                console.error('YouTube search fallback failed:', searchError.message);
            }
        }

        // Method 3: If still not enough, get recommendations from the tracks we found
        if (allTracks.length < limit && allTracks.length > 0) {
            const remainingNeeded = limit - allTracks.length;
            const trackToExpand = allTracks[Math.floor(Math.random() * allTracks.length)];

            try {
                const moreRelated = await youtube.getVideo(trackToExpand.info.identifier);

                if (moreRelated && moreRelated.related) {
                    const relatedVideos = moreRelated.related.items || [];

                    for (const relatedVideo of relatedVideos) {
                        if (allTracks.length >= limit) break;

                        if (!relatedVideo.id || processedIds.has(relatedVideo.id)) continue;
                        if (relatedVideo.isLive) continue;

                        processedIds.add(relatedVideo.id);

                        let duration = 0;
                        if (relatedVideo.duration) {
                            duration = relatedVideo.duration * 1000;
                        }

                        allTracks.push({
                            track: `youtube:${relatedVideo.id}`,
                            info: {
                                identifier: relatedVideo.id,
                                title: relatedVideo.title || 'Unknown Title',
                                author: relatedVideo.channel?.name || 'Unknown Artist',
                                length: duration,
                                uri: `https://www.youtube.com/watch?v=${relatedVideo.id}`,
                                artworkUrl: `https://i.ytimg.com/vi/${relatedVideo.id}/maxresdefault.jpg`,
                                thumbnail: `https://i.ytimg.com/vi/${relatedVideo.id}/maxresdefault.jpg`,
                                sourceName: 'youtube',
                                requester: requester
                            },
                            autoplay: true,
                            requester: requester
                        });
                    }
                }
            } catch (expandError) {
                console.error('Expand recommendations failed:', expandError.message);
            }
        }

        console.log(`✅ Found ${allTracks.length} recommended tracks`);
        return allTracks;

    } catch (error) {
        console.error('Error fetching YouTube recommendations:', error.message);
        return [];
    }
}

/**
 * Add tracks to player queue
 * @param {object} player - Poru player instance
 * @param {Array|object} tracks - Track or array of tracks to add
 */
export async function addToQueue(player, tracks) {
    if (!player) return;

    const tracksArray = Array.isArray(tracks) ? tracks : [tracks];

    for (const track of tracksArray) {
        player.queue.add(track);
    }
}
