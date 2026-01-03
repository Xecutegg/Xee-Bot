import { EmbedBuilder } from 'discord.js';
import { getClientConfig } from '../../database/models/ClientConfig.js';
import { resolveUserGlobal } from '../../utils/resolveUserGlobal.js';
import config from '../../config.js';

export default {
    name: 'unblockuser',
    devOnly: true,
    category: 'ONLYDEVS',
    description: 'Unblock a previously blocked user',
    usage: 'unblockuser <user>',
    aliases: ['unblock-user', 'user-unblock', 'uu'],
    async execute(client, message, args) {
        // Check if user is authorized
        if (!config.devs.includes(message.author.id)) {
            return message.reply('You do not have permission to use this command.');
        }

        if (!args[0]) {
            return message.reply('Please provide a user ID, mention, or username to unblock.');
        }

        // Try to resolve user from mention, ID, or username
        let user;
        if (message.mentions.users.size > 0) {
            user = message.mentions.users.first();
        } else {
            user = await resolveUserGlobal(client, args[0]);
        }

        if (!user) {
            return message.reply('User not found. Please provide a valid user mention, ID, or username.');
        }

        try {
            const clientConfig = await getClientConfig();

            // Check if user is blocked
            const blockedUser = clientConfig.blocklistusers.find(u => u.id === user.id);
            if (!blockedUser) {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.WARNING)
                    .setTitle('⚠️ Not Blocked')
                    .setDescription(`**${user.tag}** is not currently blocked from using the bot.`)
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            // Remove user from blocklist
            clientConfig.blocklistusers = clientConfig.blocklistusers.filter(u => u.id !== user.id);
            await clientConfig.save();

            console.log(`[BLOCK SYSTEM] User ${user.tag} (${user.id}) has been unblocked by ${message.author.tag} (${message.author.id})`);

            // Try to DM the unblocked user
            try {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.EMBED_COLORS.SUCCESS)
                            .setTitle('✅ Bot Access Restored')
                            .setDescription(`You have been unblocked from using **${client.user.username}** by ${message.author.tag}`)
                            .addFields({
                                name: '🎉 Welcome Back!',
                                value: 'You can now use the bot normally again.',
                                inline: false
                            })
                            .setTimestamp()
                            .setFooter({ text: 'Thank you for your patience!' })
                    ]
                });
            } catch (dmError) {
                // Ignore if cannot DM user
                console.log(`Could not DM unblocked user ${user.tag}: ${dmError.message}`);
            }

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setTitle('✅ User Unblocked Successfully')
                .setDescription(`**${user.tag}** has been unblocked and can now use the bot.`)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    {
                        name: '👤 User',
                        value: `${user.tag} (\`${user.id}\`)`,
                        inline: true
                    },
                    {
                        name: '📝 Previously Blocked For',
                        value: blockedUser.reason || 'No reason provided',
                        inline: true
                    },
                    {
                        name: '👮 Unblocked By',
                        value: message.author.tag,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({ text: 'Global Bot Block System' });

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error unblocking user:', error);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle('❌ Error')
                .setDescription('An error occurred while unblocking the user.')
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }
    }
};
