import mongoose from 'mongoose';

const clientConfigSchema = new mongoose.Schema({
    blocklistusers: [{
        id: {
            type: String,
            required: true
        },
        reason: {
            type: String,
            required: true
        },
        blockedAt: {
            type: Date,
            default: Date.now
        },
        blockedBy: {
            type: String,
            required: true
        }
    }]
}, {
    timestamps: true
});

const ClientConfig = mongoose.model('ClientConfig', clientConfigSchema);

/**
 * Get or create client configuration
 */
export const getClientConfig = async () => {
    let config = await ClientConfig.findOne({});
    if (!config) {
        config = new ClientConfig({
            blocklistusers: []
        });
        await config.save();
    }
    return config;
};

/**
 * Check if user is blocked
 * @param {string} userId 
 */
export const isUserBlocked = async (userId) => {
    const config = await getClientConfig();
    return config.blocklistusers.some(user => user.id === userId);
};

export default ClientConfig;
