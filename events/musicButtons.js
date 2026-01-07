import {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    AttachmentBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} from 'discord.js';
import config from '../config.js';
import musicIcons from '../UI/icons/musicicons.js';
import { formatDuration } from '../handlers/poru.js';
import { dynamicCard } from '../UI/dynamicCard.js';
import { getUser } from '../database/models/User.js';

// Helper function to update the now playing message
async function updateNowPlayingMessage(client, player) {
    if (!player.nowPlayingMessage) return;

    try {
        const channel = client.channels.cache.get(player.nowPlayingMessage.channelId);
        const message = await channel?.messages.fetch(player.nowPlayingMessage.messageId);
        if (!message) return;

        const track = player.currentTrack;
        if (!track) return;

        // Get current player state
        const duration = formatDuration(track.info.length);
        const requester = track.info.requester?.username || track.requester?.username || 'Unknown';
        const platform = track.info.sourceName || 'YouTube Music';
        const trackUrl = track.info.uri || `https://www.youtube.com/watch?v=${track.info.identifier}`;
        const queueLength = player.queue.length || 0;
        const loopStatus = player.loop === 'TRACK' ? 'Track' : player.loop === 'QUEUE' ? 'Queue' : 'Off';

        // Song artwork URL
        let artworkUrl = track.info.artworkUrl || track.info.thumbnail || musicIcons.playerIcon;
        if (track.info.identifier && !artworkUrl.includes('maxresdefault')) {
            artworkUrl = `https://i.ytimg.com/vi/${track.info.identifier}/maxresdefault.jpg`;
        }

        // Generate updated dynamic card image

        let musicCardAttachment = null;
        try {
            const musicCardBuffer = await dynamicCard({
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
        } catch (cardErr) {
            console.error('Failed to regenerate music card:', cardErr);
        }

        // Rebuild the container with updated info matching initial layout
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## Xee Is Now Playing Your Favorite\n` +
                    `> **Link Of This Song : [${track.info.title}](${trackUrl})**\n` +
                    `> **Song Author : ${track.info.author || 'Unknown Artist'}**`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Large)
                    .setDivider(true)
            );

        if (musicCardAttachment) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://xee-music.png')
                )
            );
        }

        container
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Large)
                    .setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `> **Duration:** ${duration} | **Source:** ${platform} | **Volume:** ${player.volume || 100}%` +
                    `\n > **Queue:** ${queueLength} tracks | **Loop:** ${loopStatus}` +
                    `\n > **Requested By:** ${requester} | Made With Love By Xecute`
                )
            );
        // Rebuild buttons with current state
        const row1Components = message.components[1].components;
        const updatedRow1 = new ActionRowBuilder().addComponents(
            row1Components.map((btn, idx) => {
                const newBtn = ButtonBuilder.from(btn);
                // Update pause/play button (index 1)
                if (idx === 1) {
                    newBtn.setEmoji(player.isPaused ? '<:push:1458308050015223849>' : '<:resume:1458310847603540143>');
                }
                return newBtn;
            })
        );

        const row2 = ActionRowBuilder.from(message.components[2]);
        const row3 = ActionRowBuilder.from(message.components[3]);

        const editPayload = {
            components: [container, updatedRow1, row2, row3],
            flags: MessageFlags.IsComponentsV2
        };

        if (musicCardAttachment) {
            editPayload.files = [musicCardAttachment];
        }

        await message.edit(editPayload);
    } catch (err) {
        console.error('Failed to update now playing message:', err);
    }
}

export default {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        const customId = interaction.customId;
        if (!customId.startsWith('music_')) return;

        const guildId = interaction.guildId;
        const player = client.poru?.players.get(guildId);

        if (!player) {
            return interaction.reply({
                content: '❌ No active music player in this server.',
                ephemeral: true
            });
        }

        try {
            // Check if user is in voice channel
            const member = interaction.member;
            if (!member.voice.channel) {
                return interaction.reply({
                    content: '❌ You need to be in a voice channel to use music controls.',
                    ephemeral: true
                });
            }

            // Check if user is in same voice channel as bot
            if (member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
                return interaction.reply({
                    content: '❌ You must be in the same voice channel as the bot.',
                    ephemeral: true
                });
            }

            // Handle different button actions
            if (customId.includes('_pause_')) {
                // Check if player is connected and has tracks
                if (!player.isConnected && !player.isPlaying && !player.isPaused) {
                    return interaction.reply({
                        content: '❌ Nothing is currently playing.',
                        ephemeral: true
                    });
                }
                const wasPaused = player.isPaused;
                player.pause(!wasPaused);

                // Update the now playing message button
                if (player.nowPlayingMessage) {
                    try {
                        const channel = client.channels.cache.get(player.nowPlayingMessage.channelId);
                        const message = await channel?.messages.fetch(player.nowPlayingMessage.messageId);

                        if (message && message.components) {
                            // Rebuild row1 with updated pause button
                            const row1Components = message.components[1].components;
                            const updatedRow1 = new ActionRowBuilder().addComponents(
                                row1Components.map((btn, idx) => {
                                    const newBtn = ButtonBuilder.from(btn);
                                    // Update pause/play button (index 1 since we removed previous button)
                                    if (idx === 1) {
                                        newBtn.setEmoji(!wasPaused ? '<:push:1458308050015223849>' : '<:resume:1458310847603540143>');
                                    }
                                    return newBtn;
                                })
                            );

                            // Keep other rows unchanged
                            const allComponents = [
                                message.components[0], // Container
                                updatedRow1,
                                message.components[2], // Row2
                                message.components[3]  // Row3
                            ];

                            await message.edit({ components: allComponents });
                        }
                    } catch (err) {
                        console.error('Failed to update now playing message:', err);
                    }
                }

                await interaction.reply({
                    content: wasPaused ? '▶️ Resumed playing' : '⏸️ Paused',
                    flags: 64
                });
            }
            else if (customId.includes('_skip_')) {
                if (!player.queue || player.queue.length === 0) {
                    player.destroy();
                    return interaction.reply({
                        content: '⏭️ No more tracks in queue. Stopped the player.',
                        ephemeral: true
                    });
                }
                await player.skip();
                await interaction.reply({
                    content: '⏭️ Skipped to next track',
                    ephemeral: true
                });
            }
            else if (customId.includes('_previous_')) {
                await interaction.reply({
                    content: '⏮️ Previous track feature coming soon!',
                    ephemeral: true
                });
            }
            else if (customId.includes('_stop_')) {
                player.destroy();
                await interaction.reply({
                    content: '⏹️ Stopped and cleared queue',
                    ephemeral: true
                });
            }
            else if (customId.includes('_volup_')) {
                const currentVol = player.volume || 100;
                const newVol = Math.min(currentVol + 10, 100);
                player.setVolume(newVol);

                await updateNowPlayingMessage(client, player);

                await interaction.reply({
                    content: `🔊 Volume increased to ${newVol}%`,
                    ephemeral: true
                });
            }
            else if (customId.includes('_voldown_')) {
                const currentVol = player.volume || 100;
                const newVol = Math.max(currentVol - 10, 0);
                player.setVolume(newVol);

                await updateNowPlayingMessage(client, player);

                await interaction.reply({
                    content: `🔉 Volume decreased to ${newVol}%`,
                    ephemeral: true
                });
            }
            else if (customId.includes('_shuffle_')) {
                if (!player.queue || player.queue.length === 0) {
                    return interaction.reply({
                        content: '❌ Queue is empty. Add more tracks to shuffle.',
                        ephemeral: true
                    });
                }
                if (player.queue.length < 2) {
                    return interaction.reply({
                        content: '❌ Need at least 2 tracks in queue to shuffle.',
                        ephemeral: true
                    });
                }
                player.queue.shuffle();
                await interaction.reply({
                    content: `🔀 Queue shuffled (${player.queue.length} tracks)`,
                    ephemeral: true
                });
            }
            else if (customId.includes('_loop_')) {
                const currentLoop = player.loop;
                if (!currentLoop || currentLoop === 'NONE') {
                    player.setLoop('TRACK');
                    await updateNowPlayingMessage(client, player);
                    await interaction.reply({
                        content: '🔂 Looping current track',
                        ephemeral: true
                    });
                } else if (currentLoop === 'TRACK') {
                    player.setLoop('QUEUE');
                    await updateNowPlayingMessage(client, player);
                    await interaction.reply({
                        content: '🔁 Looping queue',
                        ephemeral: true
                    });
                } else {
                    player.setLoop('NONE');
                    await updateNowPlayingMessage(client, player);
                    await interaction.reply({
                        content: '➡️ Loop disabled',
                        ephemeral: true
                    });
                }
            }
            else if (customId.includes('_queue_')) {
                const queue = player.queue;
                if (!queue || queue.length === 0) {
                    return interaction.reply({
                        content: '📋 Queue is empty',
                        ephemeral: true
                    });
                }

                const queueList = queue.slice(0, 10).map((track, i) =>
                    `${i + 1}. **${track?.info?.title || 'Unknown'}** - ${track?.info?.author || 'Unknown'}`
                ).join('\n');

                await interaction.reply({
                    content: `📋 **Current Queue (${queue.length} tracks)**\n\n${queueList}${queue.length > 10 ? `\n\n...and ${queue.length - 10} more` : ''}`,
                    ephemeral: true
                });
            }
            else if (customId.includes('_clear_')) {
                if (!player.queue || player.queue.length === 0) {
                    return interaction.reply({
                        content: '❌ Queue is already empty',
                        ephemeral: true
                    });
                }
                player.queue.clear();
                await interaction.reply({
                    content: '🗑️ Queue cleared',
                    ephemeral: true
                });
            }
            else if (customId.includes('_replay_')) {
                if (!player.currentTrack || !player.currentTrack.info) {
                    return interaction.reply({
                        content: '❌ No track is currently playing',
                        ephemeral: true
                    });
                }
                if (player.currentTrack.info.length === 0) {
                    return interaction.reply({
                        content: '❌ Cannot replay live streams',
                        ephemeral: true
                    });
                }
                player.seekTo(0);
                await interaction.reply({
                    content: '🔁 Replaying current track',
                    ephemeral: true
                });
            }
            else if (customId.includes('_forward_')) {
                if (!player.currentTrack || !player.currentTrack.info) {
                    return interaction.reply({
                        content: '❌ No track is currently playing',
                        ephemeral: true
                    });
                }
                const currentPos = player.position || 0;
                const trackLength = player.currentTrack.info.length || 0;
                if (trackLength === 0) {
                    return interaction.reply({
                        content: '❌ Cannot seek in live streams',
                        ephemeral: true
                    });
                }
                const seekTo = Math.min(currentPos + 10000, trackLength - 1000);
                player.seekTo(seekTo);
                await interaction.reply({
                    content: '⏩ Forwarded 10 seconds',
                    ephemeral: true
                });
            }
            else if (customId.includes('_rewind_')) {
                if (!player.currentTrack || !player.currentTrack.info) {
                    return interaction.reply({
                        content: '❌ No track is currently playing',
                        ephemeral: true
                    });
                }
                if (player.currentTrack.info.length === 0) {
                    return interaction.reply({
                        content: '❌ Cannot seek in live streams',
                        ephemeral: true
                    });
                }
                const currentPos = player.position || 0;
                const seekTo = Math.max(currentPos - 10000, 0);
                player.seekTo(seekTo);
                await interaction.reply({
                    content: '⏪ Rewinded 10 seconds',
                    ephemeral: true
                });
            }
            else if (customId.includes('_like_')) {
                if (!player.currentTrack || !player.currentTrack.info) {
                    return interaction.reply({
                        content: '❌ No track is currently playing',
                        flags: 64
                    });
                }

                const track = player.currentTrack;
                const userId = interaction.user.id;

                // Get user from database
                const userDb = await getUser(interaction.user);

                // Check if already liked
                const alreadyLiked = userDb.likedSongs.some(s => s.url === track.info.uri);
                if (alreadyLiked) {
                    return interaction.reply({
                        content: '💚 This song is already in your liked songs!',
                        flags: 64
                    });
                }

                // Add to liked songs in database
                userDb.likedSongs.push({
                    title: track.info.title,
                    author: track.info.author,
                    url: track.info.uri,
                    thumbnail: track.info.artworkUrl || track.info.thumbnail,
                    duration: track.info.length,
                    likedAt: new Date()
                });

                await userDb.save();

                await interaction.reply({
                    content: `💚 Added **${track.info.title}** to your liked songs!`,
                    flags: 64
                });
            }

        } catch (error) {
            console.error('Error handling music button:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing your request.',
                    ephemeral: true
                }).catch(() => { });
            }
        }
    }
};
