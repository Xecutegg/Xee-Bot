import {
    MessageFlags,
    TextDisplayBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    ThumbnailBuilder,
    ChannelType,
} from "discord.js";
import config from "../../config.js";
import { timeformat } from "../../utils/timeformat.js";
import os from "os";

export default {
    name: "botinfo",
    description: "Shows EliteQ Information",
    category: "INFO",
    botperms: ["EmbedLinks"],
    userperms: ["SendMessages"],
    cooldown: 5,
    aliases: ["botstats", "stats", "about", "bi"],
    is_premium: false,

    async execute(client, message, args) {
        const response = await getBotStats(client, message);
        await message.reply(response);
    },
};

async function getBotStats(client, message) {
    try {
        // STATS
        const guilds = client.guilds.cache.size;
        const channels = client.channels.cache.size;
        const users = client.guilds.cache.reduce(
            (size, g) => size + g.memberCount,
            0
        );

        // Channel Stats
        const textChannels = client.channels.cache.filter(
            (c) => c.type === ChannelType.GuildText
        ).size;
        const voiceChannels = client.channels.cache.filter(
            (c) => c.type === ChannelType.GuildVoice
        ).size;
        const stageChannels = client.channels.cache.filter(
            (c) => c.type === ChannelType.GuildStageVoice
        ).size;

        // Command Stats
        const commandsPath = client.commands || new Map();
        const totalCommands = commandsPath.size || 0;

        // SYSTEM STATS
        const platform = process.platform.replace(/win32/g, "Windows");
        const architecture = os.arch();
        const cores = os.cpus().length;
        const cpuUsage = `${((process.cpuUsage().user / 1000000 / cores) * 100).toFixed(2)}%`;

        // RAM STATS
        const totalRAM = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const usedRAM = (
            (os.totalmem() - os.freemem()) /
            1024 /
            1024 /
            1024
        ).toFixed(2);
        const ramUsage = `${usedRAM}GB / ${totalRAM}GB`;

        // TOP SERVERS
        const topServers = Array.from(client.guilds.cache.values())
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 5)
            .map(
                (guild, i) =>
                    `${i === 0 ? "<a:greendot:1380120847356006432>" : config.dot_emoji} ${guild.name} ${config.dot_emoji} ${guild.memberCount.toLocaleString()} members`
            )
            .join("\n");

        // CREATE BUTTONS
        const inviteButton = new ButtonBuilder()
            .setLabel("Add to Server")
            .setStyle(ButtonStyle.Link);

        if (client.generateInvite) {
            try {
                const inviteLink = client.generateInvite({
                    scopes: ["bot", "applications.commands"],
                    permissions: ["Administrator"],
                });
                inviteButton.setURL(inviteLink);
            } catch (error) {
                console.log("Could not generate invite link:", error.message);
            }
        }

        const supportButton = new ButtonBuilder()
            .setLabel("Support Server")
            .setURL(config.SUPPORT_SERVER)
            .setStyle(ButtonStyle.Link);

        const dashboardButton = config.DASHBOARD?.enabled
            ? new ButtonBuilder()
                .setLabel("Web Dashboard")
                .setURL('https://xecute.me')
                .setStyle(ButtonStyle.Link)
            : null;

        // CREATE STYLED CONTAINER
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `# [Xeee Information](${config.SUPPORT_SERVER})\n` +
                            `> Your Partner Is Now Here!!\n` +
                            `> **Version** ${config.dot_emoji} 1.5.0\n` +
                            `> **Status** ${config.dot_emoji} Online`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(
                            client.user.displayAvatarURL({ size: 256, dynamic: true })
                        )
                    )
            )

            // Separator
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
                    .setDivider(true)
            )
            // Bot Info Section with button
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## __**Xeee Statistics**__\n` +
                            `**Server Ping** ${config.dot_emoji} ${client.ws.ping}ms\n` +
                            `**Total Guilds** ${config.dot_emoji} ${guilds.toLocaleString()}\n` +
                            `**Total Users** ${config.dot_emoji} ${users.toLocaleString()}\n` +
                            `**Total Commands** ${config.dot_emoji} ${totalCommands}\n` +
                            `**Total Shards** ${config.dot_emoji} ${client.cluster ? client.cluster.info.TOTAL_SHARDS : (client.shard ? client.shard.count : 1)}`
                        )
                    )
                    .setButtonAccessory(inviteButton)
            )
            // System Statistics Section with button
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## __**System Statistics**__\n` +
                            `**Operating System** ${config.dot_emoji} ${platform}\n` +
                            `**CPU Cores** ${config.dot_emoji} ${cores}\n` +
                            `**CPU Usage** ${config.dot_emoji} ${cpuUsage}\n` +
                            `**RAM Usage** ${config.dot_emoji} ${ramUsage}\n` +
                            `**Node Version** ${config.dot_emoji} ${process.versions.node}`
                        )
                    )
                    .setButtonAccessory(supportButton)
            )
            // Channel Statistics
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## __**Channel Statistics**__\n` +
                    `**Text Channels** ${config.dot_emoji} ${textChannels}\n` +
                    `**Voice Channels** ${config.dot_emoji} ${voiceChannels}\n` +
                    `**Stage Channels** ${config.dot_emoji} ${stageChannels}`
                )
            );

        // Conditionally add Uptime section with or without dashboard button
        if (dashboardButton) {
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `__**Bot Uptime**__\n\`${timeformat(process.uptime())}\``
                        )
                    )
                    .setButtonAccessory(dashboardButton)
            );
        } else {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## __**Bot Uptime**__\n\`${timeformat(process.uptime())}\``
                )
            );
        }

        // Continue chaining
        container
            // Separator
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
                    .setDivider(true)
            )
            // Top Servers
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## __**Top Servers**__\n${topServers || "No servers found"}`
                )
            )
            // Footer with user icon - Using Section
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

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
    } catch (error) {
        console.error("Error in bot stats command:", error);
        return {
            content: "An error occurred while generating statistics.",
            flags: 64,
        };
    }
}
