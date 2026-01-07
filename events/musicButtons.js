import { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';

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
                player.stopTrack();
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
                await interaction.reply({
                    content: `🔊 Volume increased to ${newVol}%`,
                    ephemeral: true
                });
            }
            else if (customId.includes('_voldown_')) {
                const currentVol = player.volume || 100;
                const newVol = Math.max(currentVol - 10, 0);
                player.setVolume(newVol);
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
                    await interaction.reply({
                        content: '🔂 Looping current track',
                        ephemeral: true
                    });
                } else if (currentLoop === 'TRACK') {
                    player.setLoop('QUEUE');
                    await interaction.reply({
                        content: '🔁 Looping queue',
                        ephemeral: true
                    });
                } else {
                    player.setLoop('NONE');
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
            else if (customId.includes('_autoplay_')) {
                player.autoplay = !player.autoplay;
                await interaction.reply({
                    content: `📻 Autoplay ${player.autoplay ? 'enabled' : 'disabled'}`,
                    ephemeral: true
                });
            }
            else if (customId.includes('_replay_')) {
                if (!player.current || !player.current.info) {
                    return interaction.reply({
                        content: '❌ No track is currently playing',
                        ephemeral: true
                    });
                }
                if (player.current.info.length === 0) {
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
                if (!player.current || !player.current.info) {
                    return interaction.reply({
                        content: '❌ No track is currently playing',
                        ephemeral: true
                    });
                }
                const currentPos = player.position || 0;
                const trackLength = player.current.info.length || 0;
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
                if (!player.current || !player.current.info) {
                    return interaction.reply({
                        content: '❌ No track is currently playing',
                        ephemeral: true
                    });
                }
                if (player.current.info.length === 0) {
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
                if (!player.current || !player.current.info) {
                    return interaction.reply({
                        content: '❌ No track is currently playing',
                        flags: 64
                    });
                }

                // Store liked song in database/cache
                if (!client.likedSongs) client.likedSongs = new Map();

                const userId = interaction.user.id;
                if (!client.likedSongs.has(userId)) {
                    client.likedSongs.set(userId, []);
                }

                const likedSongs = client.likedSongs.get(userId);
                const track = player.current;

                // Check if already liked
                const alreadyLiked = likedSongs.some(s => s.url === track.info.uri);
                if (alreadyLiked) {
                    return interaction.reply({
                        content: '💚 This song is already in your liked songs!',
                        flags: 64
                    });
                }

                // Add to liked songs
                likedSongs.push({
                    title: track.info.title,
                    author: track.info.author,
                    url: track.info.uri,
                    thumbnail: track.info.artworkUrl || track.info.thumbnail,
                    duration: track.info.length,
                    likedAt: Date.now()
                });

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
