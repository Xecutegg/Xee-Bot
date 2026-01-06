import {
    MessageFlags,
    TextDisplayBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ThumbnailBuilder
} from 'discord.js';
import { getSettings } from '../database/models/Guild.js';
import config from '../config.js';

export async function logModerationAction(guild, action, options = {}) {
    try {
        const settings = await getSettings(guild.id);
        if (!settings?.modlog?.channelId) return;

        const channel = guild.channels.cache.get(settings.modlog.channelId);
        if (!channel) return;

        // Build content string
        let contentText = `# ${action.toUpperCase()}\n`;
        contentText += `**Moderator** • ${options.moderator || 'Unknown'}\n`;
        contentText += `**Target** • ${options.target || 'Unknown'}`;

        if (options.reason) {
            contentText += `\n**Reason** • ${options.reason}`;
        }

        if (options.duration) {
            contentText += `\n**Duration** • ${options.duration}`;
        }

        contentText += `\n\n<t:${Math.floor(Date.now() / 1000)}:F>`;

        // Create styled container with Components V2
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(contentText)
            );

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    } catch (error) {
        console.error('Error logging mod action:', error);
    }
}
