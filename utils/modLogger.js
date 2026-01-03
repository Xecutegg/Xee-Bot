import { EmbedBuilder } from 'discord.js';
import { getSettings } from '../database/models/Guild.js';

export async function logModerationAction(guild, action, options = {}) {
    try {
        const settings = await getSettings(guild.id);
        if (!settings?.modlog_channel) return;

        const channel = guild.channels.cache.get(settings.modlog_channel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(getActionColor(action))
            .setTitle(`${getActionEmoji(action)} ${action.toUpperCase()}`)
            .setTimestamp()
            .addFields(
                { name: 'Moderator', value: `${options.moderator || 'Unknown'}`, inline: true },
                { name: 'Target', value: `${options.target || 'Unknown'}`, inline: true }
            );

        if (options.reason) {
            embed.addFields({ name: 'Reason', value: options.reason });
        }

        if (options.duration) {
            embed.addFields({ name: 'Duration', value: options.duration, inline: true });
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging mod action:', error);
    }
}

function getActionColor(action) {
    const colors = {
        ban: '#ff0000',
        unban: '#00ff00',
        kick: '#ff6600',
        warn: '#ffaa00',
        timeout: '#ff9900',
        untimeout: '#00ff00',
        lock: '#ff0000',
        unlock: '#00ff00',
        hide: '#ff6600',
        unhide: '#00ff00',
        role: '#0099ff',
        removewarn: '#00ff00',
        clearwarnings: '#00ff00'
    };
    return colors[action.toLowerCase()] || '#0099ff';
}

function getActionEmoji(action) {
    const emojis = {
        ban: '🔨',
        unban: '✅',
        kick: '👢',
        warn: '⚠️',
        timeout: '⏰',
        untimeout: '✅',
        lock: '🔒',
        unlock: '🔓',
        hide: '👁️',
        unhide: '👁️',
        role: '🎭',
        removewarn: '✅',
        clearwarnings: '✅'
    };
    return emojis[action.toLowerCase()] || '📝';
}
