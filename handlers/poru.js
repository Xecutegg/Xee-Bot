import { Poru } from "poru";
import config from "../config.js";

/**
 * Initialize Poru music manager
 * @param {import("discord.js").Client} client
 */
export default function initializePoru(client) {
    try {
        // Validate lavalink nodes configuration
        if (!config.MUSIC?.LAVALINK_NODES || config.MUSIC.LAVALINK_NODES.length === 0) {
            console.error('❌ No Lavalink nodes configured');
            return null;
        }

        console.log('🎵 Initializing Poru music system...');

        // Initialize Poru with enhanced configuration
        const poru = new Poru(client, config.MUSIC.LAVALINK_NODES, {
            resumeKey: client.user?.id || "XeeBot",
            resumeTimeout: 60,
            reconnectTries: 5,
            reconnectTimeout: 30,
            autoResolve: true,
            defaultPlatform: config.MUSIC.DEFAULT_SOURCE || "ytsearch",
            library: "discord.js"
        });

        // Enhanced error handling for raw events (Voice State Updates)
        client.on("raw", (data) => {
            try {
                if (!data || !data.t) return;

                if (data.t === "VOICE_STATE_UPDATE" || data.t === "VOICE_SERVER_UPDATE") {
                    if (poru && typeof poru.updateVoiceState === 'function') {
                        poru.updateVoiceState(data);
                    }
                }
            } catch (error) {
                console.error('❌ Error in voice state update:', error);
            }
        });

        // Attach poru to client
        client.poru = poru;

        // Node connection events
        poru.on("nodeConnect", (node) => {
            console.log(`✅ Lavalink node "${node.name}" connected`);
        });

        poru.on("nodeDisconnect", (node, reason) => {
            console.warn(`⚠️ Lavalink node "${node.name}" disconnected: ${reason || 'Unknown reason'}`);
        });

        poru.on("nodeError", (node, error) => {
            console.error(`❌ Lavalink node "${node.name}" error:`, error);
        });

        poru.on("nodeReconnect", (node) => {
            console.log(`🔄 Lavalink node "${node.name}" reconnecting...`);
        });

        // Track events
        poru.on("trackStart", (player, track) => {
            const channel = client.channels.cache.get(player.textChannel);
            if (channel) {
                channel.send({
                    embeds: [{
                        color: parseInt(config.EMBED_COLORS.BOT_EMBED.replace('#', ''), 16),
                        title: '🎵 Now Playing',
                        description: `**[${track.info.title}](${track.info.uri})**`,
                        fields: [
                            {
                                name: 'Duration',
                                value: formatDuration(track.info.length),
                                inline: true
                            },
                            {
                                name: 'Requested by',
                                value: track.info.requester ? `<@${track.info.requester.id}>` : 'Unknown',
                                inline: true
                            }
                        ],
                        thumbnail: { url: track.info.artworkUrl || track.info.thumbnail }
                    }]
                }).catch(console.error);
            }
        });

        poru.on("trackEnd", (player, track) => {
            console.log(`Track ended: ${track.info.title}`);
        });

        poru.on("queueEnd", (player) => {
            const channel = client.channels.cache.get(player.textChannel);
            if (channel) {
                channel.send({
                    embeds: [{
                        color: parseInt(config.EMBED_COLORS.BOT_EMBED.replace('#', ''), 16),
                        description: '✅ Queue has ended. No more songs to play!'
                    }]
                }).catch(console.error);
            }

            // Destroy player after queue ends
            setTimeout(() => {
                if (player && !player.isPlaying) {
                    player.destroy();
                }
            }, 30000); // Wait 30 seconds before destroying
        });

        poru.on("playerCreate", (player) => {
            console.log(`🎵 Player created for guild: ${player.guildId}`);
        });

        poru.on("playerDestroy", (player) => {
            console.log(`🗑️ Player destroyed for guild: ${player.guildId}`);
        });

        poru.on("trackError", (player, track, error) => {
            console.error('❌ Track error:', error);
            const channel = client.channels.cache.get(player.textChannel);
            if (channel) {
                channel.send({
                    embeds: [{
                        color: parseInt(config.EMBED_COLORS.ERROR.replace('#', ''), 16),
                        description: `❌ An error occurred while playing **${track.info.title}**`
                    }]
                }).catch(console.error);
            }
        });

        // Debug events (optional)
        poru.on("debug", (message) => {
            // Uncomment to see debug logs
            // console.log(`🐛 Poru Debug: ${message}`);
        });

        // Initialize and connect to Lavalink nodes
        poru.init();

        console.log('✅ Poru music system initialized successfully');
        console.log('🔄 Connecting to Lavalink nodes...');

        return poru;

    } catch (error) {
        console.error('❌ Failed to initialize Poru:', error);
        return null;
    }
}

/**
 * Format duration from milliseconds to readable string
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
    if (!ms || ms === 0) return "🔴 LIVE";

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
}

export { formatDuration };
