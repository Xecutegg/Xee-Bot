import {
    AuditLogEvent,
    ContainerBuilder,
    MessageFlags,
    PermissionsBitField,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from "discord.js";
import { getSettings } from "../database/models/Guild.js";
import config from "../config.js";

const actionMeta = {
    [AuditLogEvent.GuildUpdate]: { title: "Guild Updated", scope: "Guild", level: "high" },
    [AuditLogEvent.ChannelCreate]: { title: "Channel Created", scope: "Channel", level: "medium" },
    [AuditLogEvent.ChannelUpdate]: { title: "Channel Updated", scope: "Channel", level: "medium" },
    [AuditLogEvent.ChannelDelete]: { title: "Channel Deleted", scope: "Channel", level: "high" },
    [AuditLogEvent.ChannelOverwriteCreate]: { title: "Permission Overwrite Created", scope: "Channel", level: "medium" },
    [AuditLogEvent.ChannelOverwriteUpdate]: { title: "Permission Overwrite Updated", scope: "Channel", level: "medium" },
    [AuditLogEvent.ChannelOverwriteDelete]: { title: "Permission Overwrite Deleted", scope: "Channel", level: "medium" },
    [AuditLogEvent.MemberKick]: { title: "Member Kicked", scope: "Member", level: "high" },
    [AuditLogEvent.MemberPrune]: { title: "Inactive Members Pruned", scope: "Member", level: "high" },
    [AuditLogEvent.MemberBanAdd]: { title: "Member Banned", scope: "Member", level: "critical" },
    [AuditLogEvent.MemberBanRemove]: { title: "Member Unbanned", scope: "Member", level: "high" },
    [AuditLogEvent.MemberUpdate]: { title: "Member Updated", scope: "Member", level: "medium" },
    [AuditLogEvent.MemberRoleUpdate]: { title: "Member Roles Updated", scope: "Member", level: "high" },
    [AuditLogEvent.MemberMove]: { title: "Member Moved", scope: "Member", level: "medium" },
    [AuditLogEvent.MemberDisconnect]: { title: "Member Disconnected", scope: "Member", level: "medium" },
    [AuditLogEvent.BotAdd]: { title: "Bot Added", scope: "Member", level: "high" },
    [AuditLogEvent.RoleCreate]: { title: "Role Created", scope: "Role", level: "medium" },
    [AuditLogEvent.RoleUpdate]: { title: "Role Updated", scope: "Role", level: "high" },
    [AuditLogEvent.RoleDelete]: { title: "Role Deleted", scope: "Role", level: "high" },
    [AuditLogEvent.InviteCreate]: { title: "Invite Created", scope: "Invite", level: "medium" },
    [AuditLogEvent.InviteUpdate]: { title: "Invite Updated", scope: "Invite", level: "medium" },
    [AuditLogEvent.InviteDelete]: { title: "Invite Deleted", scope: "Invite", level: "medium" },
    [AuditLogEvent.WebhookCreate]: { title: "Webhook Created", scope: "Webhook", level: "high" },
    [AuditLogEvent.WebhookUpdate]: { title: "Webhook Updated", scope: "Webhook", level: "high" },
    [AuditLogEvent.WebhookDelete]: { title: "Webhook Deleted", scope: "Webhook", level: "high" },
    [AuditLogEvent.EmojiCreate]: { title: "Emoji Created", scope: "Emoji", level: "low" },
    [AuditLogEvent.EmojiUpdate]: { title: "Emoji Updated", scope: "Emoji", level: "low" },
    [AuditLogEvent.EmojiDelete]: { title: "Emoji Deleted", scope: "Emoji", level: "medium" },
    [AuditLogEvent.MessageDelete]: { title: "Message Deleted", scope: "Message", level: "medium" },
    [AuditLogEvent.MessageBulkDelete]: { title: "Bulk Messages Deleted", scope: "Message", level: "high" },
    [AuditLogEvent.MessagePin]: { title: "Message Pinned", scope: "Message", level: "low" },
    [AuditLogEvent.MessageUnpin]: { title: "Message Unpinned", scope: "Message", level: "low" },
    [AuditLogEvent.IntegrationCreate]: { title: "Integration Created", scope: "Integration", level: "medium" },
    [AuditLogEvent.IntegrationUpdate]: { title: "Integration Updated", scope: "Integration", level: "medium" },
    [AuditLogEvent.IntegrationDelete]: { title: "Integration Deleted", scope: "Integration", level: "high" },
    [AuditLogEvent.StageInstanceCreate]: { title: "Stage Instance Created", scope: "Stage", level: "low" },
    [AuditLogEvent.StageInstanceUpdate]: { title: "Stage Instance Updated", scope: "Stage", level: "low" },
    [AuditLogEvent.StageInstanceDelete]: { title: "Stage Instance Deleted", scope: "Stage", level: "medium" },
    [AuditLogEvent.StickerCreate]: { title: "Sticker Created", scope: "Sticker", level: "low" },
    [AuditLogEvent.StickerUpdate]: { title: "Sticker Updated", scope: "Sticker", level: "low" },
    [AuditLogEvent.StickerDelete]: { title: "Sticker Deleted", scope: "Sticker", level: "medium" },
    [AuditLogEvent.ThreadCreate]: { title: "Thread Created", scope: "Thread", level: "low" },
    [AuditLogEvent.ThreadUpdate]: { title: "Thread Updated", scope: "Thread", level: "low" },
    [AuditLogEvent.ThreadDelete]: { title: "Thread Deleted", scope: "Thread", level: "medium" },
    [AuditLogEvent.ApplicationCommandPermissionUpdate]: { title: "Command Permissions Updated", scope: "Application", level: "high" },
    [AuditLogEvent.AutoModerationRuleCreate]: { title: "AutoMod Rule Created", scope: "AutoMod", level: "high" },
    [AuditLogEvent.AutoModerationRuleUpdate]: { title: "AutoMod Rule Updated", scope: "AutoMod", level: "high" },
    [AuditLogEvent.AutoModerationRuleDelete]: { title: "AutoMod Rule Deleted", scope: "AutoMod", level: "high" },
    [AuditLogEvent.AutoModerationBlockMessage]: { title: "AutoMod Blocked Message", scope: "AutoMod", level: "high" },
    [AuditLogEvent.AutoModerationFlagToChannel]: { title: "AutoMod Flagged Message", scope: "AutoMod", level: "medium" },
    [AuditLogEvent.AutoModerationUserCommunicationDisabled]: { title: "AutoMod Timed Out Member", scope: "AutoMod", level: "critical" },
};

const actionTypeMap = {
    1: "Create",
    2: "Delete",
    3: "Update",
    4: "All",
};

const permissionKeys = new Set(["allow", "deny", "permissions"]);

const changeFieldLabels = {
    hoist: "Display role members separately",
    mentionable: "Allow anyone to mention this role",
    managed: "Role managed by integration",
    nsfw: "NSFW mode",
    temporary: "Temporary membership",
    deaf: "Server deafened",
    mute: "Server muted",
    nick: "Nickname",
    permissions: "Permissions",
    allow: "Allowed permissions",
    deny: "Denied permissions",
};

function truncate(value, max = 300) {
    const text = String(value ?? "");
    if (text.length <= max) return text;
    return `${text.slice(0, max - 3)}...`;
}

function safeBlockValue(value, max = 180) {
    if (value === undefined) return "not set";
    if (value === null) return "null";

    if (typeof value === "string") {
        return truncate(value.replace(/```/g, "'''").replace(/\n/g, "\\n"), max);
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    try {
        return truncate(JSON.stringify(value).replace(/```/g, "'''"), max);
    } catch {
        return "[unserializable]";
    }
}

function normalizeChangeKey(rawKey) {
    return String(rawKey || "unknown").toLowerCase();
}

function labelForChangeKey(rawKey) {
    const normalized = normalizeChangeKey(rawKey);
    if (changeFieldLabels[normalized]) return changeFieldLabels[normalized];

    return String(rawKey || "unknown")
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2");
}

function parseBooleanLike(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const lowered = value.trim().toLowerCase();
        if (lowered === "true") return true;
        if (lowered === "false") return false;
    }
    return null;
}

function formatBooleanByKey(key, booleanValue) {
    switch (key) {
        case "hoist":
            return booleanValue
                ? "Enabled (members shown separately in member list)"
                : "Disabled (members shown in normal member list)";
        case "mentionable":
            return booleanValue
                ? "Enabled (anyone can mention this role)"
                : "Disabled (only users with permission can mention)";
        case "managed":
            return booleanValue
                ? "Yes (managed by Discord integration)"
                : "No (manually managed role)";
        case "nsfw":
            return booleanValue ? "Enabled" : "Disabled";
        default:
            return booleanValue ? "Enabled" : "Disabled";
    }
}

function formatChangeValue(normalizedKey, value, max = 140) {
    const asBoolean = parseBooleanLike(value);
    if (asBoolean !== null) {
        return formatBooleanByKey(normalizedKey, asBoolean);
    }

    return safeBlockValue(value, max);
}

function humanizePermission(permission) {
    return String(permission).replace(/([a-z])([A-Z])/g, "$1 $2");
}

function parsePermissions(bitValue) {
    if (bitValue === undefined || bitValue === null) return [];

    try {
        const bits = typeof bitValue === "bigint" ? bitValue : BigInt(String(bitValue).trim() || "0");
        if (bits === 0n) return [];
        return new PermissionsBitField(bits).toArray();
    } catch {
        return [];
    }
}

function formatPermissionList(permissions, max = 220) {
    if (!permissions.length) return "none";
    return truncate(permissions.map(humanizePermission).join(", "), max);
}

function permissionDiffText(oldValue, newValue) {
    const oldPerms = parsePermissions(oldValue);
    const newPerms = parsePermissions(newValue);

    const oldSet = new Set(oldPerms);
    const newSet = new Set(newPerms);

    const added = newPerms.filter((perm) => !oldSet.has(perm));
    const removed = oldPerms.filter((perm) => !newSet.has(perm));

    return {
        oldText: formatPermissionList(oldPerms),
        newText: formatPermissionList(newPerms),
        addedText: formatPermissionList(added),
        removedText: formatPermissionList(removed),
        hasDelta: added.length > 0 || removed.length > 0,
    };
}

function formatTarget(entry) {
    if (!entry.target) {
        if (entry.targetId) {
            return `Unknown (${entry.targetId})`;
        }
        return "Unknown";
    }

    const target = entry.target;
    const targetTag = target.tag || target.name || target.username;
    const targetId = target.id || entry.targetId || "Unknown ID";

    const rendered = typeof target.toString === "function" ? String(target) : null;
    const isMentionLike = rendered && rendered !== "[object Object]" && rendered !== targetTag;

    if (isMentionLike) {
        return `${rendered} (${targetId})`;
    }

    if (targetTag) {
        return `${targetTag} (${targetId})`;
    }

    return `ID: ${targetId}`;
}

function formatExecutor(entry, guild) {
    const executorId = entry.executorId || entry.executor?.id || null;
    if (!executorId) {
        return {
            text: "Unknown",
            avatarURL: guild.client.user.displayAvatarURL({ size: 256, dynamic: true }),
        };
    }

    const member = guild.members.cache.get(executorId);
    const display = member?.user?.tag || entry.executor?.tag || entry.executor?.username;
    const avatarURL =
        member?.user?.displayAvatarURL?.({ size: 256, dynamic: true }) ||
        entry.executor?.displayAvatarURL?.({ size: 256, dynamic: true }) ||
        guild.client.user.displayAvatarURL({ size: 256, dynamic: true });

    return {
        text: `<@${executorId}> (${display || "Unknown"}) [${executorId}]`,
        avatarURL,
    };
}

function buildChangesText(changes) {
    if (!Array.isArray(changes) || !changes.length) {
        return "No field changes payload was provided by Discord for this entry.";
    }

    const lines = [];
    const visible = changes.slice(0, 12);

    for (let i = 0; i < visible.length; i++) {
        const change = visible[i];
        const rawKey = String(change.key || "unknown");
        const normalizedKey = normalizeChangeKey(rawKey);
        const key = labelForChangeKey(rawKey);
        const isPermissionField =
            permissionKeys.has(normalizedKey) || normalizedKey.includes("permission");

        let oldVal;
        let newVal;
        let permissionDiff = null;

        if (isPermissionField) {
            permissionDiff = permissionDiffText(change.old, change.new);
            oldVal = permissionDiff.oldText;
            newVal = permissionDiff.newText;
        } else {
            oldVal = formatChangeValue(normalizedKey, change.old, 140);
            newVal = formatChangeValue(normalizedKey, change.new, 140);
        }

        lines.push(`${i + 1}. ${key}`);
        lines.push(`   old: ${oldVal}`);
        lines.push(`   new: ${newVal}`);
        if (permissionDiff?.hasDelta) {
            lines.push(`   added: ${permissionDiff.addedText}`);
            lines.push(`   removed: ${permissionDiff.removedText}`);
        }
        lines.push("");
    }

    if (changes.length > 12) {
        lines.push(`...and ${changes.length - 12} more change(s)`);
    }

    return truncate(lines.join("\n").trim(), 3000);
}

function actionTypeLabel(type) {
    if (type === undefined || type === null) return "Unknown";
    return actionTypeMap[type] || String(type);
}

export default {
    name: "guildAuditLogEntryCreate",
    async execute(auditLog, guild) {
        try {
            if (!guild) return;

            const settings = await getSettings(guild.id);
            if (!settings?.auditlog?.enabled || !settings?.auditlog?.channelId) return;

            let channel = guild.channels.cache.get(settings.auditlog.channelId);
            if (!channel) {
                channel = await guild.channels.fetch(settings.auditlog.channelId).catch(() => null);
            }

            if (!channel || !channel.isTextBased()) return;

            const meta = actionMeta[auditLog.action] || {
                title: `Audit Action ${auditLog.action}`,
                scope: "Unknown",
                level: "medium",
            };

            const reason = auditLog.reason ? truncate(auditLog.reason, 500) : "No reason provided";
            const executor = formatExecutor(auditLog, guild);
            const target = formatTarget(auditLog);
            const changesText = buildChangesText(auditLog.changes || []);
            const createdUnix = Math.floor((auditLog.createdTimestamp || Date.now()) / 1000);

            const headerText = truncate(
                `# ${config.mod_emoji} ${meta.title}\n` +
                `> Advanced real-time audit stream for this server\n` +
                `> Scope: ${meta.scope} | Priority: ${meta.level.toUpperCase()}`,
                3500
            );

            const detailsText = truncate(
                `## Audit Overview\n` +
                `**Action Code** ${config.dot_emoji} \`${auditLog.action}\`\n` +
                `**Action Type** ${config.dot_emoji} ${actionTypeLabel(auditLog.actionType)}\n` +
                `**Executor** ${config.dot_emoji} ${executor.text}\n` +
                `**Target** ${config.dot_emoji} ${target}\n` +
                `**Reason** ${config.dot_emoji} ${reason}\n` +
                `**Created** ${config.dot_emoji} <t:${createdUnix}:F>\n` +
                `**Entry ID** ${config.dot_emoji} \`${auditLog.id}\`\n` +
                `**Guild** ${config.dot_emoji} ${guild.name} (\`${guild.id}\`)`,
                3500
            );

            const changesBlock = truncate(
                `## Change Log (${Array.isArray(auditLog.changes) ? auditLog.changes.length : 0})\n` +
                "```md\n" +
                `${changesText}\n` +
                "```",
                3500
            );

            const deliveredAtText = `Logged by ${guild.client.user.username} at <t:${Math.floor(Date.now() / 1000)}:T>`;

            const container = new ContainerBuilder();

            const headerSection = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText));
            if (executor.avatarURL) {
                headerSection.setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(executor.avatarURL)
                );
            }

            container
                .addSectionComponents(headerSection)
                .addSeparatorComponents(
                    new SeparatorBuilder()
                        .setSpacing(SeparatorSpacingSize.Small)
                        .setDivider(true)
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailsText))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(changesBlock))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(deliveredAtText));

            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            console.error("Audit log forwarding error:", error);
        }
    },
};
