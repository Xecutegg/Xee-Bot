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
    ActionRowBuilder,
    AttachmentBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} from "discord.js";
import musicIcons from "../UI/icons/musicicons.js";
import { dynamicCard } from "../UI/dynamicCard.js";
import { getUpNext, addToQueue } from "../utils/youtubeAutoplay.js";

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
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

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

                // Song artwork URL - Get best quality
                let artworkUrl = track.info.artworkUrl || track.info.thumbnail || musicIcons.playerIcon;

                // If YouTube video, try to get maxresdefault thumbnail
                if (track.info.identifier && !artworkUrl.includes('maxresdefault')) {
                    artworkUrl = `https://i.ytimg.com/vi/${track.info.identifier}/maxresdefault.jpg`;
                }

                // Generate dynamic music card image
                let musicCardBuffer;
                let musicCardAttachment;
                try {
                    musicCardBuffer = await dynamicCard({
                        thumbnailURL: artworkUrl,
                        songTitle: track.info.title,
                        songArtist: track.info.author || 'Unknown Artist',
                        trackRequester: requester,
                        duration: duration,
                        queueLength: queueLength,
                        volume: player.volume || 100,
                        platform: platform
                    });
                    musicCardAttachment = new AttachmentBuilder(musicCardBuffer, { name: 'xee-music.png' });
                } catch (cardError) {
                    console.error('Error generating music card:', cardError);
                    musicCardBuffer = null;
                }

                // Create the styled container with Components V2
                const container = new ContainerBuilder()
                    // Header Section with Title
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## Xee Is Now Playing Your Favorite\n` +
                            `> **Link Of This Song : [${track.info.title}](${trackUrl})**\n` +
                            `> **Song Author : ${track.info.author || 'Unknown Artist'}**`
                        )
                    )
                    // Separator
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setSpacing(SeparatorSpacingSize.Large)
                            .setDivider(true)
                    );

                // Add music card image to container if generated
                if (musicCardBuffer && musicCardAttachment) {
                    container.addMediaGalleryComponents(
                        new MediaGalleryBuilder()
                            .addItems(
                                new MediaGalleryItemBuilder()
                                    .setURL('attachment://xee-music.png')
                            )
                    );
                }

                // Add track details section
                container.addSeparatorComponents(
                    new SeparatorBuilder()
                        .setSpacing(SeparatorSpacingSize.Large)
                        .setDivider(true)
                )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `> **Queue:** ${queueLength} Tracks\n` +
                            `> **Duration:** ${duration} | **Source:** ${platform} | **Volume:** ${player.volume || 100}%\n` +
                            `> **Requested By:** ${requester} | Made With Love By Xecute`
                        )
                    );

                // Create action rows for buttons
                const row1 = new ActionRowBuilder()
                    .addComponents(rewindBtn, playPauseBtn, forwardBtn, skipBtn);

                const row2 = new ActionRowBuilder()
                    .addComponents(queueBtn, volumeDownBtn, stopBtn, volumeUpBtn);

                const row3 = new ActionRowBuilder()
                    .addComponents(replayBtn, loopBtn, autoplayBtn, likeBtn);

                // Prepare message payload
                const messagePayload = {
                    components: [container, row1, row2, row3],
                    flags: MessageFlags.IsComponentsV2
                };

                // Add music card as attachment if generated
                if (musicCardBuffer && musicCardAttachment) {
                    messagePayload.files = [musicCardAttachment];
                }

                // Send the Components V2 message with embedded image
                const nowPlayingMsg = await channel.send(messagePayload);

                // Store message ID in player for future updates
                player.nowPlayingMessage = {
                    messageId: nowPlayingMsg.id,
                    channelId: nowPlayingMsg.channel.id
                };

            } catch (error) {
                console.error('Error sending now playing message:', error);
            }
        });

        poru.on("trackEnd", async (player, track) => {
            console.log(`Track ended: ${track.info.title}`);

            // Check if autoplay is enabled and queue is running low (less than 10 tracks)
            if (player.autoplay && player.queue.length < 10) {
                const currentTrack = track;

                // Only support YouTube/YouTube Music for autoplay
                if (currentTrack?.info?.sourceName?.toLowerCase().includes('youtube')) {
                    try {
                        console.log(`🔄 Queue running low (${player.queue.length} tracks), fetching more recommendations...`);

                        const upNext = await getUpNext(
                            currentTrack.info.identifier,
                            { username: `${client.user.username} Autoplay` },
                            20 // Fetch 20 more tracks to refill queue
                        );

                        if (upNext && upNext.length > 0) {
                            // Filter out tracks already in queue to avoid duplicates
                            const existingTrackIds = player.queue.map(t => t.info?.identifier).filter(Boolean);
                            const newTracks = upNext.filter(t => !existingTrackIds.includes(t.info?.identifier));

                            if (newTracks.length > 0) {
                                // Add tracks to queue
                                await addToQueue(player, newTracks);
                                console.log(`✅ Added ${newTracks.length} autoplay tracks to queue (Total: ${player.queue.length})`);
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error fetching autoplay tracks:', error.message);
                    }
                }
            }
        });

        poru.on("queueEnd", async (player) => {
            const channel = client.channels.cache.get(player.textChannel);

            // If autoplay is enabled, try to fetch and play related tracks
            if (player.autoplay) {
                const lastTrack = player.previousTrack || player.currentTrack;

                // Only support YouTube/YouTube Music for autoplay
                if (lastTrack?.info?.sourceName?.toLowerCase().includes('youtube')) {
                    try {
                        if (channel) {
                            await channel.send({
                                embeds: [{
                                    color: parseInt(config.EMBED_COLORS.BOT_EMBED.replace('#', ''), 16),
                                    description: '📻 Autoplay enabled, fetching 50 related tracks...'
                                }]
                            }).catch(console.error);
                        }

                        const upNext = await getUpNext(
                            lastTrack.info.identifier,
                            { username: `${client.user.username} Autoplay` },
                            50 // Fetch 50 tracks
                        );

                        if (upNext && upNext.length > 0) {
                            // Add tracks to queue
                            await addToQueue(player, upNext);

                            // Start playing if not already
                            if (!player.isPlaying) {
                                await player.play();
                            }

                            if (channel) {
                                await channel.send({
                                    embeds: [{
                                        color: parseInt(config.EMBED_COLORS.BOT_EMBED.replace('#', ''), 16),
                                        description: `✅ Added ${upNext.length} autoplay tracks to queue!`
                                    }]
                                }).catch(console.error);
                            }

                            console.log(`✅ Added ${upNext.length} autoplay tracks and resumed playback`);
                            return; // Don't destroy player if autoplay succeeded
                        } else {
                            throw new Error('No autoplay tracks found');
                        }
                    } catch (error) {
                        console.error('❌ Autoplay error:', error.message);
                        player.autoplay = false; // Disable autoplay on error

                        if (channel) {
                            await channel.send({
                                embeds: [{
                                    color: parseInt(config.EMBED_COLORS.ERROR.replace('#', ''), 16),
                                    description: '❌ Autoplay disabled due to error. Queue has ended.'
                                }]
                            }).catch(console.error);
                        }
                    }
                } else {
                    if (channel) {
                        await channel.send({
                            embeds: [{
                                color: parseInt(config.EMBED_COLORS.ERROR.replace('#', ''), 16),
                                description: '❌ Autoplay only supports YouTube/YouTube Music. Queue has ended.'
                            }]
                        }).catch(console.error);
                    }
                }
            }

            // Default queue end behavior (if autoplay is off or failed)
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
            // Initialize autoplay as false by default
            player.autoplay = false;
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
