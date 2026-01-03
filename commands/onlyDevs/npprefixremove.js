import { EmbedBuilder } from 'discord.js';
import { getUser } from '../../database/models/User.js';
import { resolveUserGlobal } from '../../utils/resolveUserGlobal.js';
import config from '../../config.js';

export default {
    name: 'npprefixremove',
    devOnly: true,
    category: 'ONLYDEVS',
    description: 'Remove a user from the global no-prefix list',
    usage: 'npprefixremove <user>',
    aliases: ['np-remove', 'npremove'],
    async execute(client, message, args) {
        // Check if user is authorized
        if (!config.devs.includes(message.author.id)) {
            return message.reply('You do not have permission to use this command.');
        }

        if (!args[0]) {
            return message.reply('Please provide a user to remove from the no-prefix list.');
        }

        const user = await resolveUserGlobal(client, args[0]);
        if (!user) {
            return message.reply('User not found. Please provide a valid user ID, mention, or username.');
        }

        try {
            const userDb = await getUser(user);

            if (!userDb.noPrefix) {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.WARNING)
                    .setTitle('⚠️ Not Found')
                    .setDescription(`**${user.tag}** is not in the global no-prefix users list.`)
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            userDb.noPrefix = false;
            await userDb.save();

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setTitle('✅ Global No-Prefix User Removed')
                .setDescription(`**${user.tag}** has been removed from the global no-prefix users list.\n\nThey now need to use the server prefix to run commands in all servers.`)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    {
                        name: '👤 User',
                        value: `${user.tag} (\`${user.id}\`)`,
                        inline: true
                    },
                    {
                        name: '🌍 Scope',
                        value: `Global (All Servers)`,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({ text: 'Global No-Prefix System' });

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error removing global no-prefix user:', error);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle('❌ Error')
                .setDescription('An error occurred while removing the user from the global no-prefix list.')
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }
    }
};
