import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import config from '../../config.js';
import { getUser } from '../../database/models/User.js';

export default {
    name: 'likedsongs',
    description: 'View your liked songs',
    category: 'MUSIC',
    botperms: ['SendMessages', 'EmbedLinks'],
    userperms: ['SendMessages'],
    is_premium: false,
    cooldown: 5,
    aliases: ['likes', 'likedmusic', 'favoritemusic'],

    async execute(client, message, args) {
        // Get user's liked songs from database
        const userDb = await getUser(message.author);

        if (!userDb.likedSongs || userDb.likedSongs.length === 0) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.ERROR)
                    .setDescription('❌ You haven\'t liked any songs yet!\nUse the 💚 button on the now playing message to like songs.')
                ]
            });
        }

        const likedSongs = userDb.likedSongs;

        // Pagination settings
        const itemsPerPage = 10;
        const totalPages = Math.ceil(likedSongs.length / itemsPerPage);
        let currentPage = 0;

        // Function to create embed for current page
        const createEmbed = (page) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageSongs = likedSongs.slice(start, end);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.BOT_EMBED)
                .setAuthor({
                    name: `${message.author.username}'s Liked Songs`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setDescription(
                    pageSongs.map((song, idx) => {
                        const duration = formatDuration(song.duration);
                        const position = start + idx + 1;
                        return `\`${position}.\` **[${song.title}](${song.url})**\n${config.dot_emoji} ${song.author} ${config.dot_emoji} ${duration}`;
                    }).join('\n\n')
                )
                .setFooter({
                    text: `Page ${page + 1}/${totalPages} • Total: ${likedSongs.length} songs`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            return embed;
        };

        // Create buttons
        const getButtons = (page) => {
            const row = new ActionRowBuilder();

            const firstBtn = new ButtonBuilder()
                .setCustomId('liked_first')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0);

            const prevBtn = new ButtonBuilder()
                .setCustomId('liked_prev')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0);

            const pageBtn = new ButtonBuilder()
                .setCustomId('liked_page')
                .setLabel(`${page + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true);

            const nextBtn = new ButtonBuilder()
                .setCustomId('liked_next')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1);

            const lastBtn = new ButtonBuilder()
                .setCustomId('liked_last')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1);

            row.addComponents(firstBtn, prevBtn, pageBtn, nextBtn, lastBtn);
            return row;
        };

        // Send initial message
        const msg = await message.reply({
            embeds: [createEmbed(currentPage)],
            components: totalPages > 1 ? [getButtons(currentPage)] : []
        });

        // No pagination needed if only 1 page
        if (totalPages <= 1) return;

        // Create collector for buttons
        const collector = msg.createMessageComponentCollector({
            filter: (i) => i.user.id === message.author.id,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'liked_first') {
                currentPage = 0;
            } else if (interaction.customId === 'liked_prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (interaction.customId === 'liked_next') {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            } else if (interaction.customId === 'liked_last') {
                currentPage = totalPages - 1;
            }

            await interaction.update({
                embeds: [createEmbed(currentPage)],
                components: [getButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            msg.edit({ components: [] }).catch(() => { });
        });
    }
};

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
