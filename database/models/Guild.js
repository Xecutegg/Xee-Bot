import { Schema, model } from 'mongoose';

const guildSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, default: null },
    isPremium: { type: Boolean, default: false },
    premiumExpiry: { type: Date, default: null },

    // Moderation Settings
    modlog: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null }
    },

    // Warning Settings
    warnings: {
        maxWarnings: { type: Number, default: 3 },
        actions: [{
            count: { type: Number, required: true },
            action: { type: String, enum: ['timeout', 'kick', 'ban'], required: true },
            duration: { type: Number, default: null }
        }]
    },

    // Update channel
    updateChannelId: { type: String, default: null }
}, {
    timestamps: true
});

const Guild = model('Guild', guildSchema);

/**
 * Get or create guild settings
 * @param {string} guildId 
 */
export const getSettings = async (guildId) => {
    let guild = await Guild.findOne({ guildId });
    if (!guild) {
        guild = new Guild({
            guildId,
            prefix: null,
            isPremium: false,
            modlog: {
                enabled: false,
                channelId: null
            },
            warnings: {
                maxWarnings: 3,
                actions: []
            }
        });
        await guild.save();
    }
    return guild;
};

/**
 * Update guild settings
 * @param {string} guildId 
 * @param {object} data 
 */
export const updateSettings = async (guildId, data) => {
    return await Guild.findOneAndUpdate(
        { guildId },
        { $set: data },
        { new: true, upsert: true }
    );
};

/**
 * Get all premium guilds
 */
export const getPremiumGuilds = async () => {
    return await Guild.find({ isPremium: true });
};

/**
 * Get all guilds with update channel
 */
export const getGuildsWithUpdateChannel = async () => {
    return await Guild.find({ updateChannelId: { $ne: null } });
};

export default Guild;
