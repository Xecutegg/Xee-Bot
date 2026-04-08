import config from '../config.js';
import { getUser } from '../database/models/User.js';
import {
    MessageFlags,
    TextDisplayBuilder,
    ContainerBuilder,
    SectionBuilder,
    ButtonBuilder,
    ButtonStyle,
    ThumbnailBuilder,
} from 'discord.js';

const cooldowns = new Map();

export default {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;

        // Check if bot is mentioned
        if (message.mentions.has(client.user.id) && message.content.trim() === `<@${client.user.id}>`) {
            return handleBotMention(message, client);
        }

        // Get user data to check noPrefix status
        const userDb = await getUser(message.author);
        const hasNoPrefix = userDb?.noPrefix || false;

        // Determine if message has prefix
        const hasPrefix = message.content.startsWith(config.prefix);

        // If user has noPrefix, allow both with and without prefix
        // If user doesn't have noPrefix, require prefix
        if (!hasNoPrefix && !hasPrefix) return;

        // Parse command and arguments based on whether prefix is present
        let args, commandName;
        if (hasPrefix) {
            args = message.content.slice(config.prefix.length).trim().split(/ +/);
            commandName = args.shift().toLowerCase();
        } else {
            // No prefix case (only for noPrefix users)
            args = message.content.trim().split(/ +/);
            commandName = args.shift().toLowerCase();
        }

        // Find command by name or alias
        const command = client.commands.get(commandName) ||
            client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        try {
            // Check bot permissions
            if (command.botperms) {
                const botMember = message.guild.members.cache.get(client.user.id);
                const missingPerms = command.botperms.filter(
                    perm => !botMember.permissions.has(perm)
                );

                if (missingPerms.length > 0) {
                    return message.reply({
                        content: `❌ I need the following permissions: ${missingPerms.join(', ')}`,
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
                    });
                }
            }

            // Check user permissions
            if (command.userperms) {
                const missingPerms = command.userperms.filter(
                    perm => !message.member.permissions.has(perm)
                );

                if (missingPerms.length > 0) {
                    return message.reply({
                        content: `${config.cross_emoji} | You Need This \`${missingPerms.join(', ')}\` Permission to Use This Command!`,
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
                    });
                }
            }

            // Check cooldown
            if (command.cooldown) {
                const now = Date.now();
                const cooldownKey = `${message.author.id}-${command.name}`;

                if (cooldowns.has(cooldownKey)) {
                    const expirationTime = cooldowns.get(cooldownKey) + (command.cooldown * 1000);

                    if (now < expirationTime) {
                        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
                        return message.reply({
                            content: `⏱ Please wait ${timeLeft}s before using this command again.`,
                            flags: 64,
                            allowedMentions: { parse: [], repliedUser: false }
                        });
                    }
                }

                cooldowns.set(cooldownKey, now);
                setTimeout(() => cooldowns.delete(cooldownKey), command.cooldown * 1000);
            }

            // Execute command
            await command.execute(client, message, args);

        } catch (error) {
            console.error(`Error executing command ${command.name}:`, error);
            message.reply({
                content: '❌ An error occurred while executing this command.',
                flags: 64,
                allowedMentions: { parse: [], repliedUser: false }
            }).catch(console.error);
        }
    },
};

async function handleBotMention(message, client) {
    try {
        // Create invite button
        const inviteButton = new ButtonBuilder()
            .setLabel('Add to Server')
            .setStyle(ButtonStyle.Link);

        if (client.generateInvite) {
            try {
                const inviteLink = client.generateInvite({
                    scopes: ['bot', 'applications.commands'],
                    permissions: ['Administrator'],
                });
                inviteButton.setURL(inviteLink);
            } catch (error) {
                console.log('Could not generate invite link:', error.message);
            }
        }

        const supportButton = new ButtonBuilder()
            .setLabel('Support Server')
            .setURL(config.SUPPORT_SERVER)
            .setStyle(ButtonStyle.Link);

        // Create Components V2 container
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `# Hey ${message.author.username}!\n` +
                            `> I'm **${client.user.username}**, your partner is here!\n\n` +
                            `**My Prefix** ${config.dot_emoji} \`${config.prefix}\`\n` +
                            `**Server Ping** ${config.dot_emoji} ${client.ws.ping}ms\n` +
                            `**Total Guilds** ${config.dot_emoji} ${client.guilds.cache.size.toLocaleString()}\n` +
                            `**Total Users** ${config.dot_emoji} ${client.guilds.cache.reduce((size, g) => size + g.memberCount, 0).toLocaleString()}`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(
                            client.user.displayAvatarURL({ size: 256, dynamic: true })
                        )
                    )
                    .setButtonAccessory(inviteButton)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `Type \`${config.prefix}help\` to see all commands!\n` +
                            `Join our support server for help and updates.`
                        )
                    )
                    .setButtonAccessory(supportButton)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**xecute.me**\nRequested by ${message.author.username}`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(
                            message.author.displayAvatarURL({ dynamic: true })
                        )
                    )
            );

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [], repliedUser: false }
        });
    } catch (error) {
        console.error('Error in bot mention handler:', error);
        return message.reply({
            content: `Hey ${message.author.username}! My prefix is \`${config.prefix}\`\nType \`${config.prefix}help\` for all commands!`,
            flags: 64,
            allowedMentions: { parse: [], repliedUser: false }
        });
    }
}
