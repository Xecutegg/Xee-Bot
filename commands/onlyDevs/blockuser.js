import { EmbedBuilder } from 'discord.js';
import { getClientConfig } from '../../database/models/ClientConfig.js';
import { resolveUserGlobal } from '../../utils/resolveUserGlobal.js';
import config from '../../config.js';

export default {
    name: 'blockuser',
    devOnly: true,
    category: 'ONLYDEVS',
    description: 'Block a user from using the bot',
    usage: 'blockuser <user> <reason>',
    aliases: ['block-user', 'userblock', 'bu'],
    async execute(client, message, args) {
        // Check if user is authorized
        if (!config.devs.includes(message.author.id)) {
            return message.reply('You do not have permission to use this command.');
        }

        if (!args[0]) {
            return message.reply('Please provide a user ID, mention, or username to block.');
        }

        if (!args[1]) {
            return message.reply('Please provide a reason for blocking this user.');
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

        const reason = args.slice(1).join(' ');

        try {
            const clientConfig = await getClientConfig();

            // Check if user is already blocked
            if (clientConfig.blocklistusers.find(u => u.id === user.id)) {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.WARNING)
                    .setTitle('⚠️ Already Blocked')
                    .setDescription(`**${user.tag}** is already blocked from using the bot.`)
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            // Add user to blocklist
            clientConfig.blocklistusers.push({
                id: user.id,
                reason: reason,
                blockedBy: message.author.id,
                blockedAt: new Date()
            });
            await clientConfig.save();

            console.log(`[BLOCK SYSTEM] User ${user.tag} (${user.id}) has been blocked by ${message.author.tag} (${message.author.id}). Reason: ${reason}`);

            // Try to DM the blocked user
            let dmSent = false;
            try {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.EMBED_COLORS.ERROR)
                            .setTitle('🚫 Bot Access Blocked')
                            .setDescription(`You have been blocked from using **${client.user.username}** by ${message.author.tag}`)
                            .addFields({
                                name: 'Reason',
                                value: reason,
                                inline: false
                            })
                            .setTimestamp()
                            .setFooter({ text: 'If you believe this is a mistake, contact the bot developers.' })
                    ]
                });
                dmSent = true;
            } catch (dmError) {
                // User has DMs disabled or blocked the bot
                console.log(`Could not DM blocked user ${user.tag}: ${dmError.message}`);
            }

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setTitle('✅ User Blocked Successfully')
                .setDescription(`**${user.tag}** has been blocked from using the bot.${dmSent ? '' : '\n\n⚠️ Could not send DM notification (user has DMs disabled).'}`)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    {
                        name: '👤 User',
                        value: `${user.tag} (\`${user.id}\`)`,
                        inline: true
                    },
                    {
                        name: '📝 Reason',
                        value: reason,
                        inline: true
                    },
                    {
                        name: '👮 Blocked By',
                        value: message.author.tag,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({ text: 'Global Bot Block System' });

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error blocking user:', error);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle('❌ Error')
                .setDescription('An error occurred while blocking the user.')
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }
    }
};
