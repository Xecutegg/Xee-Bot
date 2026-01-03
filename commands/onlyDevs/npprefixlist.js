import { EmbedBuilder } from 'discord.js';
import User from '../../database/models/User.js';
import config from '../../config.js';

export default {
    name: 'npprefixlist',
    devOnly: true,
    category: 'ONLYDEVS',
    description: 'List all users in the global no-prefix list',
    usage: 'npprefixlist',
    aliases: ['np-list', 'nplist'],
    async execute(client, message, args) {
        // Check if user is authorized
        if (!config.devs.includes(message.author.id)) {
            return message.reply('You do not have permission to use this command.');
        }

        try {
            // Get all users with noPrefix: true from database
            const noPrefixUsers = await User.find({ noPrefix: true });

            if (!noPrefixUsers || noPrefixUsers.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.BOT_EMBED)
                    .setTitle('📋 Global No-Prefix Users')
                    .setDescription('No users are currently in the global no-prefix list.')
                    .setTimestamp()
                    .setFooter({ text: 'Global No-Prefix System' });

                return message.reply({ embeds: [embed] });
            }

            const userList = [];
            for (const userDoc of noPrefixUsers) {
                try {
                    const user = await client.users.fetch(userDoc._id);
                    userList.push(`• ${user.tag} (\`${user.id}\`)`);
                } catch (error) {
                    userList.push(`• Unknown User (\`${userDoc._id}\`)`);
                }
            }

            // Split into chunks if the list is too long
            const chunks = [];
            const chunkSize = 10;
            for (let i = 0; i < userList.length; i += chunkSize) {
                chunks.push(userList.slice(i, i + chunkSize));
            }

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.BOT_EMBED)
                .setTitle('📋 Global No-Prefix Users')
                .setDescription('**Users who can use commands without prefix in all servers**')
                .addFields(
                    {
                        name: '👤 Users',
                        value: chunks[0].join('\n') || 'None',
                        inline: false
                    },
                    {
                        name: '📊 Statistics',
                        value: `Total global no-prefix users: **${noPrefixUsers.length}**`,
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({ text: 'Global No-Prefix System' });

            // If there are more chunks, add them as additional fields
            if (chunks.length > 1) {
                for (let i = 1; i < chunks.length && i < 5; i++) {
                    embed.addFields({
                        name: '👤 Users (continued)',
                        value: chunks[i].join('\n'),
                        inline: false
                    });
                }

                if (chunks.length > 5) {
                    embed.addFields({
                        name: 'ℹ️ Note',
                        value: `... and ${userList.length - (5 * chunkSize)} more users`,
                        inline: false
                    });
                }
            }

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error listing global no-prefix users:', error);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching the global no-prefix users list.')
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }
    }
};
