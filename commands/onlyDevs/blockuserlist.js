import { EmbedBuilder } from 'discord.js';
import { getClientConfig } from '../../database/models/ClientConfig.js';
import config from '../../config.js';

export default {
    name: 'blockuserlist',
    devOnly: true,
    category: 'ONLYDEVS',
    description: 'List all blocked users',
    usage: 'blockuserlist',
    aliases: ['block-list', 'blocklist', 'bl'],
    async execute(client, message, args) {
        // Check if user is authorized
        if (!config.devs.includes(message.author.id)) {
            return message.reply('You do not have permission to use this command.');
        }

        try {
            const clientConfig = await getClientConfig();

            if (!clientConfig.blocklistusers || clientConfig.blocklistusers.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.BOT_EMBED)
                    .setTitle('📋 Blocked Users List')
                    .setDescription('No users are currently blocked from using the bot.')
                    .setTimestamp()
                    .setFooter({ text: 'Global Bot Block System' });

                return message.reply({ embeds: [embed] });
            }

            const blockedUsers = [];
            for (const blockedUser of clientConfig.blocklistusers) {
                try {
                    const user = await client.users.fetch(blockedUser.id);
                    const blockedBy = await client.users.fetch(blockedUser.blockedBy).catch(() => ({ tag: 'Unknown User' }));
                    const blockedDate = blockedUser.blockedAt ? new Date(blockedUser.blockedAt).toLocaleDateString() : 'Unknown';

                    blockedUsers.push({
                        user: `${user.tag} (\`${user.id}\`)`,
                        reason: blockedUser.reason || 'No reason provided',
                        blockedBy: blockedBy.tag,
                        date: blockedDate
                    });
                } catch (error) {
                    // Handle deleted/unknown users
                    blockedUsers.push({
                        user: `Unknown User (\`${blockedUser.id}\`)`,
                        reason: blockedUser.reason || 'No reason provided',
                        blockedBy: 'Unknown',
                        date: blockedUser.blockedAt ? new Date(blockedUser.blockedAt).toLocaleDateString() : 'Unknown'
                    });
                }
            }

            // Split into chunks if the list is too long
            const chunks = [];
            const chunkSize = 5; // Smaller chunks due to more detailed info
            for (let i = 0; i < blockedUsers.length; i += chunkSize) {
                chunks.push(blockedUsers.slice(i, i + chunkSize));
            }

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.BOT_EMBED)
                .setTitle('📋 Blocked Users List')
                .setDescription('**Users who are currently blocked from using the bot**')
                .setTimestamp()
                .setFooter({ text: 'Global Bot Block System' });

            // Add the first chunk
            if (chunks[0]) {
                for (let i = 0; i < chunks[0].length; i++) {
                    const blockedUser = chunks[0][i];
                    embed.addFields({
                        name: `${i + 1}. ${blockedUser.user}`,
                        value: `**Reason:** ${blockedUser.reason}\n**Blocked By:** ${blockedUser.blockedBy}\n**Date:** ${blockedUser.date}`,
                        inline: false
                    });
                }
            }

            // Add statistics
            embed.addFields({
                name: '📊 Statistics',
                value: `Total blocked users: **${clientConfig.blocklistusers.length}**`,
                inline: false
            });

            // If there are more chunks, add a note
            if (chunks.length > 1) {
                const remaining = blockedUsers.length - chunkSize;
                embed.addFields({
                    name: 'ℹ️ Note',
                    value: `... and ${remaining} more users. Use pagination to see all users.`,
                    inline: false
                });
            }

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error listing blocked users:', error);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching the blocked users list.')
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }
    }
};
