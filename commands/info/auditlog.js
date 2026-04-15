import { EmbedBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { getSettings } from "../../database/models/Guild.js";
import config from "../../config.js";

export default {
    name: "auditlog",
    description: "Configure audit log channel for advanced server update tracking",
    category: "INFO",
    botperms: ["ViewChannel", "SendMessages", "EmbedLinks"],
    userperms: ["ManageGuild", "ViewAuditLog"],
    cooldown: 5,
    aliases: ["auditlogs", "setauditlog"],
    is_premium: false,
    usage: "auditlog <set #channel | disable | status>",

    async execute(client, message, args) {
        try {
            const sub = (args[0] || "").toLowerCase();
            const guildData = await getSettings(message.guild.id);

            if (!sub) {
                const usageEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.WARNING)
                    .setTitle(`${config.info_emoji} Audit Log Setup`)
                    .setDescription(
                        `${config.dot_emoji} **Usage:** \`${(client.prefix || config.prefix)}auditlog set <#channel | channel_id>\`\n` +
                        `${config.dot_emoji} **Disable:** \`${(client.prefix || config.prefix)}auditlog disable\`\n` +
                        `${config.dot_emoji} **Status:** \`${(client.prefix || config.prefix)}auditlog status\``
                    )
                    .setFooter({
                        text: `Requested by ${message.author.username}`,
                        iconURL: message.author.displayAvatarURL(),
                    });

                return message.reply({ embeds: [usageEmbed] });
            }

            if (sub === "status") {
                const configuredChannelId = guildData?.auditlog?.channelId;
                const statusEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.BOT_EMBED)
                    .setTitle(`${config.info_emoji} Audit Log Status`)
                    .setDescription(
                        configuredChannelId
                            ? `${config.enabled} Audit log channel is set to <#${configuredChannelId}>.`
                            : `${config.disabled} Audit log channel is not configured yet.`
                    )
                    .setFooter({
                        text: `Requested by ${message.author.username}`,
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setTimestamp();

                return message.reply({ embeds: [statusEmbed] });
            }

            if (sub === "disable") {
                if (!guildData?.auditlog?.channelId) {
                    const disabledEmbed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.ERROR)
                        .setDescription(`${config.cross_emoji} | Audit log channel is not configured.`);

                    return message.reply({ embeds: [disabledEmbed] });
                }

                guildData.auditlog.channelId = null;
                guildData.auditlog.enabled = false;
                await guildData.save();

                const successEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.SUCCESS)
                    .setDescription(`${config.check_emoji} | Audit log channel has been disabled.`)
                    .setFooter({
                        text: `Disabled by ${message.author.username}`,
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setTimestamp();

                return message.reply({ embeds: [successEmbed] });
            }

            if (sub !== "set") {
                const invalidEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.ERROR)
                    .setDescription(`${config.cross_emoji} | Invalid subcommand. Use \`set\`, \`disable\`, or \`status\`.`);

                return message.reply({ embeds: [invalidEmbed] });
            }

            const input = args[1];
            if (!input) {
                const noChannelEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.ERROR)
                    .setDescription(
                        `${config.cross_emoji} | Please provide a channel mention or channel ID.\n\n` +
                        `**Example:** \`${(client.prefix || config.prefix)}auditlog set #audit-logs\``
                    );

                return message.reply({ embeds: [noChannelEmbed] });
            }

            const channelId = input.replace(/[<#>]/g, "");
            if (!/^\d{17,19}$/.test(channelId)) {
                const invalidChannelEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.ERROR)
                    .setDescription(`${config.cross_emoji} | Please provide a valid channel mention or ID.`);

                return message.reply({ embeds: [invalidChannelEmbed] });
            }

            const channel = message.guild.channels.cache.get(channelId);
            if (!channel) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.EMBED_COLORS.ERROR)
                            .setDescription(`${config.cross_emoji} | Channel not found in this server.`),
                    ],
                });
            }

            if (channel.type !== ChannelType.GuildText) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.EMBED_COLORS.ERROR)
                            .setDescription(`${config.cross_emoji} | Please select a text channel.`),
                    ],
                });
            }

            const me = message.guild.members.me || message.guild.members.cache.get(client.user.id);
            const perms = channel.permissionsFor(me);
            if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.EMBED_COLORS.ERROR)
                            .setDescription(
                                `${config.cross_emoji} | I need these permissions in ${channel}:\n` +
                                `${config.dot_emoji} View Channel\n${config.dot_emoji} Send Messages\n${config.dot_emoji} Embed Links`
                            ),
                    ],
                });
            }

            const oldChannelId = guildData?.auditlog?.channelId || null;
            const isUpdate = Boolean(oldChannelId);

            guildData.auditlog.channelId = channelId;
            guildData.auditlog.enabled = true;
            await guildData.save();

            const successEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setTitle(`${config.check_emoji} Audit Log ${isUpdate ? "Updated" : "Configured"}`)
                .setDescription(
                    `${config.dot_emoji} Audit log channel set to ${channel}.\n` +
                    `${isUpdate && oldChannelId ? `${config.dot_emoji} Previous channel: <#${oldChannelId}>\n` : ""}` +
                    `\n**Logged updates include:**\n` +
                    `${config.dot_emoji} Channel create/update/delete\n` +
                    `${config.dot_emoji} Role create/update/delete\n` +
                    `${config.dot_emoji} Member ban/unban/kick\n` +
                    `${config.dot_emoji} Message delete/bulk delete/pin updates\n` +
                    `${config.dot_emoji} Webhook, emoji, and integration updates\n` +
                    `${config.dot_emoji} Advanced details: executor, target, reason, changes`
                )
                .setFooter({
                    text: `${isUpdate ? "Updated" : "Set"} by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL(),
                })
                .setTimestamp();

            await message.reply({ embeds: [successEmbed] });

            const testEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.BOT_EMBED)
                .setTitle(`${config.info_emoji} Audit Log Ready`)
                .setDescription(
                    `This channel is now configured for advanced audit log tracking.\n` +
                    `I will forward new guild audit entries here automatically.`
                )
                .setTimestamp();

            await channel.send({ embeds: [testEmbed] });
        } catch (error) {
            console.error("Auditlog command error:", error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.ERROR)
                        .setDescription(config.MESSAGES.COMMAND_ERROR),
                ],
            }).catch(() => { });
        }
    },
};
