import { EmbedBuilder } from "discord.js";
import { getMember, addWarning } from "../database/models/Member.js";
import { getSettings } from "../database/models/Guild.js";
import { logModerationAction } from "./modLogger.js";
import config from "../config.js";

/**
 * Warn a target user
 * @param {object} issuer - Discord member who issued the warning
 * @param {object} target - Target member to warn
 * @param {string} reason - Reason for warning
 * @param {object} client - Discord client
 * @returns {object} - Response object with warning details
 */
export async function warnTarget(issuer, target, reason, client) {
    try {
        // Check if target is a bot
        if (target.user.bot) {
            return "BOT_WARN";
        }

        // Check if issuer is warning themselves
        if (issuer.id === target.id) {
            return "SELF_WARN";
        }

        // Check role hierarchy
        if (target.roles.highest.position >= issuer.roles.highest.position &&
            issuer.guild.ownerId !== issuer.id) {
            return "MEMBER_PERM";
        }

        const guildId = issuer.guild.id;
        const settings = await getSettings(guildId);

        // Initialize max_warn if it doesn't exist
        if (!settings.max_warn) {
            settings.max_warn = {
                limit: 3,
                action: "TIMEOUT"
            };
            await settings.save();
        }

        // Add warning to database
        const moderatorInfo = {
            id: issuer.user?.id || issuer.id,
            username: issuer.user?.username || issuer.displayName
        };

        await addWarning(guildId, target.id, reason || "No reason provided", moderatorInfo);

        // Get updated member data
        const updatedMember = await getMember(guildId, target.id);
        const warningCount = updatedMember.warnings || 1;
        const maxWarnings = settings.max_warn.limit || 3;

        // Log the moderation action
        await logModerationAction(issuer.guild, 'warn', {
            moderator: issuer.user || issuer,
            target: target.user,
            reason: reason || "No reason provided"
        });

        // Check if max warnings reached and take action
        let actionTaken = null;
        if (warningCount >= maxWarnings) {
            try {
                const action = settings.max_warn.action || "TIMEOUT";

                switch (action.toUpperCase()) {
                    case 'TIMEOUT':
                        await target.timeout(24 * 60 * 60 * 1000, `Reached maximum warnings (${warningCount})`);
                        actionTaken = {
                            success: true,
                            action: 'timed out',
                            duration: '24 hours'
                        };
                        break;
                    case 'KICK':
                        await target.kick(`Reached maximum warnings (${warningCount})`);
                        actionTaken = {
                            success: true,
                            action: 'kicked'
                        };
                        break;
                    case 'BAN':
                        await target.ban({ reason: `Reached maximum warnings (${warningCount})` });
                        actionTaken = {
                            success: true,
                            action: 'banned'
                        };
                        break;
                }
            } catch (err) {
                console.error('Error applying warning action:', err);
                actionTaken = {
                    success: false,
                    error: err.message
                };
            }
        }

        // Try to DM the user
        try {
            let dmDescription = `You have been warned in **${issuer.guild.name}**\n\n`;
            dmDescription += `**Reason:** ${reason || 'No reason provided'}\n`;
            dmDescription += `**Total Warnings:** ${warningCount}/${maxWarnings}`;

            const dmEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS?.WARNING || 0xffa500)
                .setTitle('⚠️ You have been warned')
                .setDescription(dmDescription)
                .setTimestamp();

            if (actionTaken && actionTaken.success) {
                dmEmbed.addFields({
                    name: '**Action Taken**',
                    value: `You have been **${actionTaken.action}** for reaching the maximum number of warnings.`,
                    inline: false
                });
            }

            await target.send({ embeds: [dmEmbed] });
        } catch (err) {
            // User has DMs disabled
        }

        return {
            success: true,
            warnings: warningCount,
            maxWarnings: maxWarnings,
            actionTaken: actionTaken
        };
    } catch (error) {
        console.error('Error in warnTarget:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
