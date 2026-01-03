import { EmbedBuilder } from 'discord.js';
import config from '../config.js';

export function buildEmbed(options = {}) {
    const embed = new EmbedBuilder()
        .setColor(options.color || config.embed_color || '#0099ff')
        .setTimestamp(options.timestamp !== false ? new Date() : null);

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.footer) embed.setFooter({ text: options.footer });
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.author) {
        embed.setAuthor({
            name: options.author.name || options.author,
            iconURL: options.author.iconURL || options.author.icon_url
        });
    }
    if (options.fields && Array.isArray(options.fields)) {
        embed.addFields(options.fields);
    }

    return embed;
}

export function successEmbed(description, title = 'Success') {
    return buildEmbed({
        title: `✅ ${title}`,
        description,
        color: '#00ff00'
    });
}

export function errorEmbed(description, title = 'Error') {
    return buildEmbed({
        title: `❌ ${title}`,
        description,
        color: '#ff0000'
    });
}

export function warningEmbed(description, title = 'Warning') {
    return buildEmbed({
        title: `⚠️ ${title}`,
        description,
        color: '#ffaa00'
    });
}
