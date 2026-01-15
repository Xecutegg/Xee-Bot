import {
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    MessageFlags,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { getYouTubeResults } from '../../ytsearch.js';
import musicIcons from '../../UI/icons/musicicons.js';
import config from '../../config.js';

export default {
    name: 'play',
    description: 'Play music in your voice channel',
    category: 'MUSIC',
    botperms: ['SendMessages', 'Connect', 'Speak'],
    userperms: ['SendMessages'],
    is_premium: true,
    aliases: ['p'],
    cooldown: 5,

    async execute(client, message, args) {
        const channel = message.member.voice.channel;

        if (!channel) {
            return message.reply({
                embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ You need to be in a voice channel to play music.')],
            });
        }

        if (!client.poru) {
            return message.reply('❌ **Music system is not available!**\nLavalink service is not connected. Please contact an administrator.');
        }

        // Get the song query
        const query = args.join(' ');

        if (!query) {
            return message.reply('Please provide a song name or URL!\nExample: `.play never gonna give you up`');
        }

        let player = client.poru.players.get(message.guild.id);

        try {
            // Check if query is a direct YouTube URL
            if (isYouTubeURL(query)) {
                return await playDirectURL(client, message, query, player, channel);
            }

            // Show loading message while searching
            const loadingMsg = await message.reply(`${config.loading_emoji} Searching for songs...`);

            // Search YouTube for results
            const ytRes = await getYouTubeResults(query);

            if (!ytRes || ytRes.length === 0) {
                return loadingMsg.edit({
                    content: null,
                    embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('🚫 No songs found for your query.')],
                });
            }

            // Delete loading message and show search results
            await loadingMsg.delete().catch(() => { });
            await showSearchResults(client, message, query, ytRes, player, channel);
        } catch (error) {
            console.error('Prefix command error:', error);
            await message.reply({
                embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('🚫 An error occurred while processing your request.')],
            }).catch(() => { });
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
async function playDirectURL(client, message, url, player, channel) {
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
                return message.reply('❌ Failed to connect to the voice channel.');
            }
        }

        // Resolve the URL using poru
        const res = await client.poru.resolve({
            query: url,
            requester: message.author
        });

        if (!res || !res.tracks || res.tracks.length === 0) {
            return message.reply({
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

        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error playing direct URL:', error);
        await message.reply({
            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('🚫 An error occurred while trying to play from the URL.')],
        }).catch(() => { });
    }
}

async function showSearchResults(client, message, query, results, player, channel) {
    const displayResults = results.slice(0, 25);
    const top3Results = displayResults.slice(0, 3);

    // Create Components V2 Container (max 10 components) - optimized
    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Search Results for: ${query}\n` +
                `> Found **${displayResults.length}** Songs • Select from dropdown`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Large)
                .setDivider(true)
        );

    // Add Top 3 Songs with Thumbnails (only 3 songs to stay under 10 component limit)
    top3Results.forEach((result, index) => {
        const title = result.title || 'Unknown Title';
        const duration = result.duration || '0:00';
        const artist = result.artists || 'Unknown Artist';
        const thumbnailUrl = result.thumbnail || musicIcons.playerIcon;

        // Add song section with thumbnail on right
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### ${config.dot_emoji} ${title}\n` +
                        `${config.dot_emoji} **Artist :** ${artist}\n` +
                        `${config.dot_emoji} **Duration :** ${duration}`
                    )
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(thumbnailUrl)
                )
        );
    });

    // Add footer
    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Large)
            .setDivider(true)
    ).addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Requested by ${message.author.username} • ${displayResults.length > 3 ? displayResults.length - 3 + ' more in dropdown' : 'Select songs below'}`
        )
    );

    // Create select menu options for dropdown (songs 4-25)
    const options = displayResults.map((result, index) => {
        const title = result.title || 'Unknown Title';
        const truncatedTitle = title.length > 100 ? title.slice(0, 97) + "..." : title;

        return {
            label: `${index + 1}. ${truncatedTitle}`,
            description: `${result.duration || '0:00'} • ${result.artists || 'Unknown Artist'}`,
            value: index.toString(),
            emoji: index < 3 ? `${config.premium_emoji}` : `${config.dot_emoji}`
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`music_search_${message.author.id}`)
        .setPlaceholder('Select Songs to Add to Queue')
        .setMinValues(1)
        .setMaxValues(Math.min(25, displayResults.length))
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

    // Send the Components V2 message with select menu
    const searchMessage = await message.channel.send({
        components: [container, row],
        flags: MessageFlags.IsComponentsV2
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
            const trackNames = addedTracks.slice(0, 5).map(track => `• ${track.title}`).join('\n');
            const moreText = addedTracks.length > 5 ? `\n...and ${addedTracks.length - 5} more` : '';

            const embed = new EmbedBuilder()
                .setColor('#DC92FF')
                .setAuthor({ name: '✅ Tracks Added to Queue', iconURL: musicIcons.correctIcon })
                .setDescription(
                    `<:music:1379761366696591461> Successfully Added **${addedTracks.length}** Song${addedTracks.length > 1 ? 'S' : ''} to the Queue`
                )
                .setFooter({
                    text: `Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

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
        const disabledRow = new ActionRowBuilder().addComponents(selectMenu);
        await searchMessage.edit({ components: [container, disabledRow] }).catch(() => { });
    });

    collector.on('end', async (collected, reason) => {
        // Clean up cache
        client.searchCache?.delete(`${message.author.id}_${message.guild.id}`);

        // Only disable menu if no interaction was collected
        if (reason === 'time' && collected.size === 0) {
            selectMenu.setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(selectMenu);
            await searchMessage.edit({ components: [container, disabledRow] }).catch(() => { });
        }
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
