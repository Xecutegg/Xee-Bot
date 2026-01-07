import { EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
    name: "unhideall",
    description: "Unhide all channels for @everyone role",
    category: "MOD",
    botperms: ["ManageChannels"],
    userperms: ["ManageChannels"],
    cooldown: 10,
    aliases: ["unhideallchannels"],
    is_premium: false,
    usage: "unhideall [reason]",

    async execute(client, message, args) {
        try {
            const reason = args.join(" ") || "No reason provided";
            const everyoneRole = message.guild.roles.everyone;

            // Get all channels in the guild that are currently hidden
            const channels = message.guild.channels.cache.filter(
                (channel) =>
                    channel.type !== ChannelType.GuildCategory &&
                    channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ManageChannels)
            );

            if (channels.size === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.ERROR)
                    .setDescription(
                        `${config.cross_emoji} | No channels found or I don't have permission to manage channels.`
                    )
                    .setFooter({
                        text: `Requested by ${message.author.username}`,
                        iconURL: message.author.displayAvatarURL(),
                    });
                return message.reply({ embeds: [errorEmbed] });
            }

            // Send processing message
            const processingEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.WARNING)
                .setDescription(
                    `${config.loading_emoji} | Unhiding ${channels.size} channels for @everyone...`
                )
                .setFooter({
                    text: `Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL(),
                });
            const processingMsg = await message.reply({ embeds: [processingEmbed] });

            // Unhide all channels
            let successCount = 0;
            let failCount = 0;

            for (const [channelId, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: null, // Reset to default/neutral
                    });
                    successCount++;
                } catch (error) {
                    console.error(`Failed to unhide channel ${channel.name}:`, error);
                    failCount++;
                }
            }

            // Update the message with results
            const resultEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setDescription(
                    `${config.check_emoji} | Successfully unhidden ${successCount} channels for @everyone.${failCount > 0 ? ` (Failed: ${failCount})` : ""}\n\n**Reason:** ${reason}`
                )
                .setFooter({
                    text: `Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL(),
                });

            await processingMsg.edit({ embeds: [resultEmbed] });

            // Log the action
            await logModerationAction(message.guild, {
                action: "Unhide All Channels",
                moderator: message.author,
                target: "All Channels",
                reason: reason,
                details: `Unhidden ${successCount} channels for @everyone`,
            });
        } catch (error) {
            console.error("Error in unhideall command:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle(`${config.cross_emoji} An Error Occurred`)
                .setDescription(
                    "An unexpected error occurred while unhiding channels. Please try again."
                )
                .setFooter({
                    text: `Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL(),
                });
            return message.reply({ embeds: [errorEmbed] }).catch(() => { });
        }
    },
};
