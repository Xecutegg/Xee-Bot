import { EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
    name: "hideall",
    description: "Hide all channels from @everyone role",
    category: "MOD",
    botperms: ["ManageChannels"],
    userperms: ["ManageChannels"],
    cooldown: 10,
    aliases: ["hideallchannels"],
    is_premium: false,
    usage: "hideall [reason]",

    async execute(client, message, args) {
        try {
            const reason = args.join(" ") || "No reason provided";
            const everyoneRole = message.guild.roles.everyone;

            // Get all channels in the guild
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
                    `${config.loading_emoji} | Hiding ${channels.size} channels from @everyone...`
                )
                .setFooter({
                    text: `Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL(),
                });
            const processingMsg = await message.reply({ embeds: [processingEmbed] });

            // Hide all channels
            let successCount = 0;
            let failCount = 0;

            for (const [channelId, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: false,
                    });
                    successCount++;
                } catch (error) {
                    console.error(`Failed to hide channel ${channel.name}:`, error);
                    failCount++;
                }
            }

            // Update the message with results
            const resultEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setDescription(
                    `${config.check_emoji} | Successfully hidden ${successCount} channels from @everyone.${failCount > 0 ? ` (Failed: ${failCount})` : ""}\n\n**Reason:** ${reason}`
                )
                .setFooter({
                    text: `Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL(),
                });

            await processingMsg.edit({ embeds: [resultEmbed] });

            // Log the action
            await logModerationAction(message.guild, {
                action: "Hide All Channels",
                moderator: message.author,
                target: "All Channels",
                reason: reason,
                details: `Hidden ${successCount} channels from @everyone`,
            });
        } catch (error) {
            console.error("Error in hideall command:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle(`${config.cross_emoji} An Error Occurred`)
                .setDescription(
                    "An unexpected error occurred while hiding channels. Please try again."
                )
                .setFooter({
                    text: `Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL(),
                });
            return message.reply({ embeds: [errorEmbed] }).catch(() => { });
        }
    },
};
