import { EmbedBuilder } from "discord.js";
import { getMember, addWarning } from "../database/models/Member.js";
import { getSettings } from "../database/models/Guild.js";
import config from "../config.js";

/**
 * Warn a target user
 * @param {object} interaction - Discord interaction or message
 * @param {object} target - Target user to warn
 * @param {string} reason - Reason for warning
 * @param {object} client - Discord client
 * @returns {object} - Embed response
 */
export async function warnTarget(interaction, target, reason, client) {
    try {
        const guildId = interaction.guild.id;
        const member = await getMember(guildId, target.id);
        const settings = await getSettings(guildId);

        // Add warning
        const moderatorInfo = {
            id: interaction.user?.id || interaction.author.id,
            username: interaction.user?.username || interaction.author.username
        };

        await addWarning(guildId, target.id, reason || "No reason provided", moderatorInfo);

        // Get updated member data
        const updatedMember = await getMember(guildId, target.id);
        const warningCount = updatedMember.warnings;

        // Check for automated actions
        let actionTaken = null;
        if (settings.warnings?.actions?.length > 0) {
            const matchingAction = settings.warnings.actions
                .sort((a, b) => b.count - a.count)
                .find(action => warningCount >= action.count);

            if (matchingAction) {
                const targetMember = interaction.guild.members.cache.get(target.id);
                if (targetMember) {
                    try {
                        switch (matchingAction.action) {
                            case 'timeout':
                                await targetMember.timeout(matchingAction.duration || 3600000, `${warningCount} warnings reached`);
                                actionTaken = `Timed out for ${Math.floor((matchingAction.duration || 3600000) / 60000)} minutes`;
                                break;
                            case 'kick':
                                await targetMember.kick(`${warningCount} warnings reached`);
                                actionTaken = 'Kicked from server';
                                break;
                            case 'ban':
                                await targetMember.ban({ reason: `${warningCount} warnings reached` });
                                actionTaken = 'Banned from server';
                                break;
                        }
                    } catch (err) {
                        console.error('Error applying warning action:', err);
                    }
                }
            }
        }

        // Create response embed
        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS?.WARNING || 0xffa500)
            .setTitle('⚠️ Warning Issued')
            .setDescription(`**${target.tag}** has been warned`)
            .addFields(
                { name: 'Reason', value: reason || 'No reason provided', inline: false },
                { name: 'Total Warnings', value: `${warningCount}`, inline: true },
                { name: 'Moderator', value: `${interaction.user?.tag || interaction.author.tag}`, inline: true }
            )
            .setTimestamp();

        if (actionTaken) {
            embed.addFields({ name: 'Action Taken', value: actionTaken, inline: false });
        }

        // Try to DM the user
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS?.WARNING || 0xffa500)
                .setTitle('⚠️ You have been warned')
                .setDescription(`You have been warned in **${interaction.guild.name}**`)
                .addFields(
                    { name: 'Reason', value: reason || 'No reason provided', inline: false },
                    { name: 'Total Warnings', value: `${warningCount}`, inline: true }
                )
                .setTimestamp();

            if (actionTaken) {
                dmEmbed.addFields({ name: 'Action Taken', value: actionTaken, inline: false });
            }

            await target.send({ embeds: [dmEmbed] });
        } catch (err) {
            // User has DMs disabled
        }

        return embed;
    } catch (error) {
        console.error('Error in warnTarget:', error);
        throw error;
    }
}
