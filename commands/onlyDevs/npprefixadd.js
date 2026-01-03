import { EmbedBuilder } from 'discord.js';
import { getUser } from '../../database/models/User.js';
import { resolveUserGlobal } from '../../utils/resolveUserGlobal.js';
import config from '../../config.js';

export default {
    name: 'npprefixadd',
    devOnly: true,
    category: 'ONLYDEVS',
    description: 'Add a user to the global no-prefix list',
    usage: 'npprefixadd <user>',
    aliases: ['np-add', 'npadd'],
    async execute(client, message, args) {
        // Check if user is authorized
        if (!config.devs.includes(message.author.id)) {
            return message.reply('You do not have permission to use this command.');
        }

        if (!args[0]) {
            return message.reply('Please provide a user to add to the no-prefix list.');
        }

        const user = await resolveUserGlobal(args[0], client);
        if (!user) {
            return message.reply('User not found. Please provide a valid user ID, mention, or username.');
        }

        try {
            const userDb = await getUser(user);

            if (userDb.noPrefix) {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.WARNING)
                    .setTitle('⚠️ Already Added')
                    .setDescription(`**${user.tag}** is already in the global no-prefix users list.`)
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            userDb.noPrefix = true;
            await userDb.save();

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setTitle('✅ Global No-Prefix User Added')
                .setDescription(`**${user.tag}** has been added to the global no-prefix users list.\n\nThey can now use commands without any prefix in **all servers**!`)
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
            console.error('Error adding global no-prefix user:', error);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle('❌ Error')
                .setDescription('An error occurred while adding the user to the global no-prefix list.')
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }
    }
};
