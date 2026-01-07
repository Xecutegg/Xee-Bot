import { Poru } from "poru";
import config from "../config.js";
import {
    MessageFlags,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    ButtonBuilder,
    ButtonStyle,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder
} from "discord.js";
import musicIcons from "../UI/icons/musicicons.js";

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
        poru.on("trackStart", async (player, track) => {
            const channel = client.channels.cache.get(player.textChannel);
            if (!channel) return;

            try {
                // Create music control buttons with Unicode emojis (guaranteed to work)
                const rewindBtn = new ButtonBuilder()
                    .setCustomId(`music_rewind_${player.guildId}`)
                    .setEmoji('<:1421028627440472154:1458308218546688031>')
                    .setStyle(ButtonStyle.Secondary);

                // Dynamic play/pause button based on player state
                const playPauseBtn = new ButtonBuilder()
                    .setCustomId(`music_pause_${player.guildId}`)
                    .setEmoji(player.isPaused ? '<:push:1458308050015223849>' : '<:resume:1458310847603540143>')
                    .setStyle(ButtonStyle.Secondary);

                const forwardBtn = new ButtonBuilder()
                    .setCustomId(`music_forward_${player.guildId}`)
                    .setEmoji('<:1421028619462905866:1458308130512568371>')
                    .setStyle(ButtonStyle.Secondary);

                const skipBtn = new ButtonBuilder()
                    .setCustomId(`music_skip_${player.guildId}`)
                    .setEmoji('<:1421028622613086319:1458308180756009214> ')
                    .setStyle(ButtonStyle.Secondary);

                // Second row buttons
                const queueBtn = new ButtonBuilder()
                    .setCustomId(`music_queue_${player.guildId}`)
                    .setEmoji('<:1421028625758552096:1458308198913278013>')
                    .setStyle(ButtonStyle.Secondary);

                const volumeDownBtn = new ButtonBuilder()
                    .setCustomId(`music_voldown_${player.guildId}`)
                    .setEmoji('<:1421028621187022848:1458308151526031412>')
                    .setStyle(ButtonStyle.Secondary);

                const stopBtn = new ButtonBuilder()
                    .setCustomId(`music_stop_${player.guildId}`)
                    .setEmoji('<:1421028637762912336:1458308366735769640')
                    .setStyle(ButtonStyle.Secondary);

                const volumeUpBtn = new ButtonBuilder()
                    .setCustomId(`music_volup_${player.guildId}`)
                    .setEmoji('<:1421028621187022848:1458308151526031412>')
                    .setStyle(ButtonStyle.Secondary);

                // Third row buttons
                const replayBtn = new ButtonBuilder()
                    .setCustomId(`music_replay_${player.guildId}`)
                    .setEmoji('<:1421028628787105793:1458308260095328441>')
                    .setStyle(ButtonStyle.Secondary);

                const loopBtn = new ButtonBuilder()
                    .setCustomId(`music_loop_${player.guildId}`)
                    .setEmoji('<:1421028644200906752:1458308487883919371>')
                    .setStyle(ButtonStyle.Secondary);

                const autoplayBtn = new ButtonBuilder()
                    .setCustomId(`music_autoplay_${player.guildId}`)
                    .setEmoji('<:1421028645589225643:1458308507932688486>')
                    .setStyle(ButtonStyle.Secondary);

                const likeBtn = new ButtonBuilder()
                    .setCustomId(`music_like_${player.guildId}`)
                    .setEmoji('<:1421028636110225468:1458308333378338907> ')
                    .setStyle(ButtonStyle.Secondary);

                // Format track info
                const duration = formatDuration(track.info.length);
                const requester = track.info.requester?.username || track.requester?.username || 'Unknown';
                const platform = track.info.sourceName || 'YouTube Music';
                const trackUrl = track.info.uri || `https://www.youtube.com/watch?v=${track.info.identifier}`;

                // Get requester avatar properly
                let requesterAvatar = musicIcons.footerIcon;
                if (track.info.requester?.avatarURL) {
                    requesterAvatar = typeof track.info.requester.avatarURL === 'function'
                        ? track.info.requester.avatarURL()
                        : track.info.requester.avatarURL;
                } else if (track.requester?.displayAvatarURL) {
                    requesterAvatar = typeof track.requester.displayAvatarURL === 'function'
                        ? track.requester.displayAvatarURL()
                        : track.requester.displayAvatarURL;
                }

                // Get queue info
                const queueLength = player.queue.length || 0;
                const loopStatus = player.loop === 'TRACK' ? `${config.check_emoji} Track` : player.loop === 'QUEUE' ? `${config.check_emoji} Queue` : `${config.cross_emoji} Off`;
                const autoplayStatus = player.autoplay ? `${config.check_emoji} On` : `${config.cross_emoji} Off`;

                // Song artwork URL
                const artworkUrl = track.info.artworkUrl || track.info.thumbnail || musicIcons.playerIcon;

                // Create the styled container with Components V2
                const container = new ContainerBuilder()
                    // Header Section with Title
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `# <a:music:834814432365248563> Now Playing\n` +
                                    `## [${track.info.title}](${trackUrl})\n` +
                                    `### ${track.info.author || 'Unknown Artist'}`
                                )
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(musicIcons.playerIcon)
                            )
                    )
                    // Separator
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setSpacing(SeparatorSpacingSize.Large)
                            .setDivider(true)
                    )
                    // Large Song Image Section (16:9 style)
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `**🎵 Track Details**\n` +
                                    `**Duration:** ${duration}\n` +
                                    `**Platform:** ${platform}\n` +
                                    `**Volume:** ${player.volume || 100}%`
                                )
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(artworkUrl)
                            )
                    )
                    // Separator
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setSpacing(SeparatorSpacingSize.Small)
                            .setDivider(true)
                    )
                    // Queue & Settings Info
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <a:beats:928310693416009828> Player Status\n` +
                            `**Queue Length** ${config.dot_emoji} ${queueLength} tracks\n` +
                            `**Loop Mode** ${config.dot_emoji} ${loopStatus}\n` +
                            `**Autoplay** ${config.dot_emoji} ${autoplayStatus}`
                        )
                    )
                    // Separator
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setSpacing(SeparatorSpacingSize.Small)
                            .setDivider(true)
                    )
                    // Footer Section with User
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `**xecute.me**\nRequested by ${requester}`
                                )
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(requesterAvatar)
                            )
                    );

                // Create traditional action rows for buttons (not part of Components V2 container)
                const row1 = new ActionRowBuilder()
                    .addComponents(rewindBtn, playPauseBtn, forwardBtn, skipBtn);

                const row2 = new ActionRowBuilder()
                    .addComponents(queueBtn, volumeDownBtn, stopBtn, volumeUpBtn);

                const row3 = new ActionRowBuilder()
                    .addComponents(replayBtn, loopBtn, autoplayBtn, likeBtn);

                // Send the now playing message
                const nowPlayingMsg = await channel.send({
                    components: [container, row1, row2, row3],
                    flags: MessageFlags.IsComponentsV2
                });

                // Store message ID in player for future updates
                player.nowPlayingMessage = {
                    messageId: nowPlayingMsg.id,
                    channelId: nowPlayingMsg.channel.id
                };

            } catch (error) {
                console.error('Error sending now playing message:', error);
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
