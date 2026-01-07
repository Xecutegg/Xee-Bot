import { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { getYouTubeResults } from '../../ytsearch.js';
import musicIcons from '../../UI/icons/musicicons.js';

export default {
    name: 'music',
    description: 'Music player commands with subcommands.',
    category: 'MUSIC',
    botperms: ['SendMessages', 'Connect', 'Speak'],
    userperms: ['SendMessages'],
    is_premium: false,
    cooldown: 5,

    async execute(client, message, args) {
        const channel = message.member.voice.channel;

        if (!channel) {
            return message.reply({
                embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ You need to be in a voice channel to use music commands.')],
            });
        }

        if (!args[0]) {
            const embed = new EmbedBuilder()
                .setColor('#DC92FF')
                .setTitle('🎵 Music Commands')
                .setDescription('Available commands:')
                .addFields(
                    { name: '.music play <song name>', value: 'Play a song by searching', inline: false },
                    { name: '.music pause', value: 'Pause the current song', inline: false },
                    { name: '.music resume', value: 'Resume the paused song', inline: false },
                    { name: '.music skip', value: 'Skip the current song', inline: false },
                    { name: '.music stop', value: 'Stop playing and clear queue', inline: false },
                    { name: '.music queue', value: 'Show the music queue', inline: false },
                    { name: '.music nowplaying', value: 'Show current song', inline: false },
                    { name: '.music volume <0-100>', value: 'Set volume level', inline: false },
                    { name: '.music shuffle', value: 'Shuffle the queue', inline: false }
                );

            return message.reply({ embeds: [embed] });
        }

        const subcommand = args[0].toLowerCase();
        const query = args.slice(1).join(' ');

        if (!client.poru) {
            return message.reply('❌ **Music system is not available!**\nLavalink service is not connected. Please contact an administrator.');
        }

        let player = client.poru.players.get(message.guild.id);

        try {
            switch (subcommand) {
                case 'play':
                    if (!query) {
                        return message.reply('Please provide a song to search for!\nExample: `.music play never gonna give you up`');
                    }

                    const statusMessage = await message.reply('🔍 Searching for songs...');

                    // Check if query is a direct YouTube URL
                    if (isYouTubeURL(query)) {
                        return await playDirectURL(client, message, query, player, channel, statusMessage);
                    }

                    // Search YouTube for results
                    const ytRes = await getYouTubeResults(query);

                    if (!ytRes || ytRes.length === 0) {
                        return statusMessage.edit({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('🚫 No songs found for your query.')],
                        });
                    }

                    // Delete the searching message
                    await statusMessage.delete().catch(() => { });

                    // Show search results with select menu
                    await showSearchResults(client, message, query, ytRes, player, channel);
                    break;

                case 'pause':
                    if (!player) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No active music player.')],
                        });
                    }
                    player.pause();
                    await message.reply('⏸️ The song has been paused.');
                    break;

                case 'resume':
                    if (!player) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No active music player.')],
                        });
                    }
                    player.pause();
                    await message.reply('▶️ The song has been resumed.');
                    break;

                case 'skip':
                    if (!player) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No active music player.')],
                        });
                    }
                    player.stop();
                    await message.reply('⏭️ The song has been skipped.');
                    break;

                case 'stop':
                    if (!player) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No active music player.')],
                        });
                    }
                    player.destroy();
                    await message.reply('⏹️ The music has been stopped, and the queue has been cleared.');
                    break;

                case 'queue':
                    if (!player) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No active music player.')],
                        });
                    }

                    const queue = player.queue;
                    if (!queue || queue.length === 0) {
                        return message.reply('❌ The queue is empty.');
                    }

                    const formattedQueue = queue.slice(0, 10).map((track, i) => `${i + 1}. **${track.info.title}**`).join('\n');

                    const queueEmbed = new EmbedBuilder()
                        .setColor('#DC92FF')
                        .setTitle('🎶 Current Queue')
                        .setDescription(formattedQueue);

                    if (queue.length > 10) {
                        queueEmbed.setFooter({ text: `And ${queue.length - 10} more songs...` });
                    }

                    await message.reply({ embeds: [queueEmbed] });
                    break;

                case 'nowplaying':
                    if (!player) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No active music player.')],
                        });
                    }

                    const currentTrack = player.current;
                    if (!currentTrack) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No track currently playing.')],
                        });
                    }

                    const npEmbed = new EmbedBuilder()
                        .setColor('#DC92FF')
                        .setTitle('🎵 Now Playing')
                        .setDescription(`**[${currentTrack.info.title}](${currentTrack.info.uri})**`);

                    if (currentTrack.info.artwork) {
                        npEmbed.setThumbnail(currentTrack.info.artwork);
                    }

                    await message.reply({ embeds: [npEmbed] });
                    break;

                case 'volume':
                    if (!player) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No active music player.')],
                        });
                    }

                    const volume = parseInt(query);
                    if (isNaN(volume) || volume < 0 || volume > 100) {
                        return message.reply('Please provide a valid volume level (0-100)!\nExample: `.music volume 50`');
                    }

                    player.setVolume(volume);
                    await message.reply(`🔊 Volume set to **${volume}%**.`);
                    break;

                case 'shuffle':
                    if (!player) {
                        return message.reply({
                            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ No active music player.')],
                        });
                    }

                    player.queue.shuffle();
                    await message.reply('🔀 The queue has been shuffled.');
                    break;

                default:
                    await message.reply(`Unknown subcommand: \`${subcommand}\`\nUse \`.music\` to see available commands.`);
                    break;
            }
        } catch (error) {
            console.error('Prefix command error:', error);
            await message.reply({
                embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('🚫 An error occurred while processing your request.')],
            });
        }
    },
};

/**
 * Check if the query is a YouTube URL (video or playlist)
 * @param {string} query
 */
function isYouTubeURL(query) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|playlist\?list=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})|([^&=%\?]{34})/;
    return youtubeRegex.test(query);
}

/**
 * Play music directly from YouTube URL (video or playlist)
 */
async function playDirectURL(client, message, url, player, channel, statusMessage) {
    try {
        if (!player) {
            try {
                player = client.poru.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: channel.id,
                    textChannel: message.channel.id,
                    deaf: true
                });
            } catch (error) {
                return statusMessage.edit('❌ Failed to connect to the voice channel.');
            }
        }

        // Resolve the URL using poru
        const res = await client.poru.resolve({
            query: url,
            requester: message.author
        });

        if (!res || !res.tracks || res.tracks.length === 0) {
            return statusMessage.edit({
                embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('🚫 No tracks found from the provided URL.')],
            });
        }

        let addedCount = 0;
        let playlistName = res.playlistInfo?.name || null;

        // Add all tracks to queue
        for (const track of res.tracks) {
            track.requester = message.author;
            player.queue.add(track);
            addedCount++;
        }

        // Start playing if not already playing
        if (!player.isPlaying && !player.isPaused && addedCount > 0) {
            player.play();
        }

        // Create response embed
        const embed = new EmbedBuilder()
            .setColor('#DC92FF')
            .setAuthor({ name: 'Track Added', iconURL: musicIcons.correctIcon })
            .setFooter({ text: `Requested by: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        if (playlistName && addedCount > 1) {
            embed.setDescription(`<:music:1379761366696591461> | Added **${addedCount} tracks** from playlist **${playlistName}** to the queue`);
        } else if (addedCount === 1) {
            const track = res.tracks[0];
            embed.setDescription(`<:music:1379761366696591461> | Added **[${track.info.title}](${track.info.uri})** to the queue`);
        } else {
            embed.setDescription(`<:music:1379761366696591461> | Added **${addedCount} tracks** to the queue`);
        }

        await statusMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.error('Error playing direct URL:', error);
        await statusMessage.edit({
            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('🚫 An error occurred while trying to play from the URL.')],
        });
    }
}

/**
 * Show YouTube search results with select menu
 */
async function showSearchResults(client, message, query, results, player, channel) {
    const displayResults = results.slice(0, 10);

    // Create embed description with numbered list
    const description = displayResults
        .map((result, index) => {
            const title = result.title || 'Unknown Title';
            const duration = result.duration || '0:00';
            const truncatedTitle = title.length > 20 ? title.slice(0, 20) + "..." : title;
            return `${index + 1}. **[\`${truncatedTitle}\`](https://discord.gg/J8gXBSt3e5)** - **\`${duration}\`**`;
        })
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor('#DC92FF')
        .setAuthor({
            name: `🔍 Search Results for: ${query}`,
            iconURL: message.author.displayAvatarURL()
        })
        .setDescription(description)
        .setFooter({
            text: `Requested by ${message.author.username} • Select songs to add to queue`,
            iconURL: message.author.displayAvatarURL()
        })
        .setTimestamp();

    // Create select menu options
    const options = displayResults.map((result, index) => {
        const title = result.title || 'Unknown Title';
        const truncatedTitle = title.length > 100 ? title.slice(0, 97) + "..." : title;

        return {
            label: truncatedTitle,
            description: `Duration: ${result.duration || '0:00'} | ${result.artists || 'Unknown Artist'}`,
            value: index.toString(),
            emoji: '🎵'
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`music_search_${message.author.id}`)
        .setPlaceholder('🎶 Select songs to add to queue...')
        .setMinValues(1)
        .setMaxValues(Math.min(10, displayResults.length))
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Store search results temporarily
    if (!client.searchCache) {
        client.searchCache = new Map();
    }

    client.searchCache.set(`${message.author.id}_${message.guild.id}`, {
        results: displayResults,
        query: query,
        timestamp: Date.now()
    });

    // Send the embed with select menu
    const searchMessage = await message.channel.send({
        embeds: [embed],
        components: [row]
    });

    // Set up collector for the select menu
    const collector = searchMessage.createMessageComponentCollector({
        filter: (interaction) => interaction.user.id === message.author.id && interaction.customId.startsWith('music_search_'),
        time: 60000,
        componentType: ComponentType.StringSelect
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferReply();

        const selectedIndices = interaction.values.map(v => parseInt(v));
        const selectedTracks = selectedIndices.map(i => displayResults[i]);

        // Process selected tracks and add to queue
        const addedTracks = await addTracksToQueue(client, message, selectedTracks, player, channel);

        if (addedTracks.length > 0) {
            const trackNames = addedTracks.map(track => `• ${track.title}`).join('\n');
            const embed = new EmbedBuilder()
                .setColor('#DC92FF')
                .setAuthor({ name: 'Track Added', iconURL: musicIcons.correctIcon })
                .setFooter({ text: `Requested by: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`<:music:1379761366696591461> | Added **${addedTracks.length} Music's** to the Playlist\n${trackNames}`);

            await interaction.editReply({
                embeds: [embed],
                ephemeral: true
            });
        } else {
            await interaction.editReply({
                content: '❌ Failed to add tracks to queue. Please try again.',
                ephemeral: true
            });
        }

        // Disable the select menu after use
        selectMenu.setDisabled(true);
        await searchMessage.edit({ components: [new ActionRowBuilder().addComponents(selectMenu)] });
    });

    collector.on('end', async () => {
        // Clean up cache
        client.searchCache?.delete(`${message.author.id}_${message.guild.id}`);

        // Disable select menu on timeout
        selectMenu.setDisabled(true);
        await searchMessage.edit({
            components: [new ActionRowBuilder().addComponents(selectMenu)]
        }).catch(() => { });
    });
}

/**
 * Add selected tracks to the music queue
 */
async function addTracksToQueue(client, message, tracks, player, channel) {
    const addedTracks = [];

    try {
        // Create player if doesn't exist
        if (!player) {
            try {
                player = client.poru.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: channel.id,
                    textChannel: message.channel.id,
                    deaf: true
                });
            } catch (error) {
                console.error('Failed to create player:', error);
                return [];
            }
        }

        // Convert YouTube results to playable tracks
        for (const ytTrack of tracks) {
            try {
                // Search using the video ID or title
                const searchQuery = ytTrack.videoId ? `https://www.youtube.com/watch?v=${ytTrack.videoId}` : ytTrack.title;
                const res = await client.poru.resolve({
                    query: searchQuery,
                    requester: message.author
                });

                if (res && res.tracks && res.tracks.length > 0) {
                    const track = res.tracks[0];
                    track.requester = {
                        id: message.author.id,
                        username: message.author.username,
                        avatarURL: message.author.displayAvatarURL()
                    };
                    player.queue.add(track);
                    addedTracks.push({
                        title: track.info.title,
                        duration: track.info.length
                    });
                }
            } catch (trackError) {
                console.error('Error adding individual track:', trackError);
            }
        }

        // Start playing if not already playing
        if (!player.isPlaying && !player.isPaused && addedTracks.length > 0) {
            player.play();
        }

        return addedTracks;
    } catch (error) {
        console.error('Error adding tracks to queue:', error);
        return [];
    }
}
