import { ActivityType } from "discord.js";
import config from "../config.js";

let activityIndex = 0;
let presenceInterval = null;

/**
 * @param {import('discord.js').Client} client
 */
async function updatePresence(client) {
    const activities = config.PRESENCE.ACTIVITIES;
    if (!activities || activities.length === 0) {
        return;
    }

    const currentActivity = activities[activityIndex];
    let message = currentActivity.message;

    // Replace placeholders with actual values
    if (message && message.includes("{servers}")) {
        message = message.replaceAll("{servers}", client.guilds.cache.size);
    }

    if (message && message.includes("{members}")) {
        const members = client.guilds.cache
            .map((g) => g.memberCount)
            .reduce((partial_sum, a) => partial_sum + a, 0);
        message = message.replaceAll("{members}", members);
    }

    const getType = (type) => {
        switch (type) {
            case "COMPETING":
                return ActivityType.Competing;

            case "LISTENING":
                return ActivityType.Listening;

            case "PLAYING":
                return ActivityType.Playing;

            case "WATCHING":
                return ActivityType.Watching;

            case "STREAMING":
                return ActivityType.Streaming;

            case "COMPLETELY":
            case "CUSTOM":
                return ActivityType.Custom;

            default:
                return ActivityType.Playing;
        }
    };

    const activityType = getType(currentActivity.type);

    // Ensure we have a valid status
    const validStatuses = ["online", "idle", "dnd", "invisible"];
    const status = validStatuses.includes(config.PRESENCE.STATUS)
        ? config.PRESENCE.STATUS
        : "online";

    try {
        // For CUSTOM activities, we need to handle them differently
        if (
            currentActivity.type === "CUSTOM" ||
            currentActivity.type === "COMPLETELY"
        ) {
            await client.user.setPresence({
                status: status,
                activities: [
                    {
                        name: "Custom Status",
                        state: message,
                        type: ActivityType.Custom,
                    },
                ],
            });
        } else if (currentActivity.type === "STREAMING") {
            await client.user.setPresence({
                status: status,
                activities: [
                    {
                        name: message,
                        type: activityType,
                        url:
                            config.PRESENCE.STREAMING_URL || "https://twitch.tv/your_channel",
                    },
                ],
            });
        } else {
            await client.user.setPresence({
                status: status,
                activities: [
                    {
                        name: message,
                        type: activityType,
                    },
                ],
            });
        }
    } catch (error) {
        console.error(`❌ Error setting presence:`, error);
        // If we hit rate limit, wait a bit longer
        if (error.code === 50035 || error.message.includes("rate limit")) {
            console.log("⏳ Hit rate limit, waiting...");
        }
    }

    // Move to next activity
    activityIndex = (activityIndex + 1) % activities.length;
}

/**
 * Stop the presence updates
 */
export function stopPresenceUpdates() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
        console.log("🛑 Presence updates stopped");
    }
}

/**
 * Start the presence update interval
 * @param {import('discord.js').Client} client - The Discord client instance
 */
async function startPresenceUpdates(client) {
    // Clear any existing interval
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }

    // Set initial presence
    await updatePresence(client);
    console.log("🎭 Initial presence set");

    // Use config interval or default to 15 seconds to respect Discord rate limits
    const interval = config.PRESENCE.INTERVAL || 15000;

    // Set up interval for presence updates
    presenceInterval = setInterval(async () => {
        await updatePresence(client);
    }, interval);

    console.log(`🔄 Presence handler initialized with ${interval}ms interval`);
}

/**
 * Initialize presence handler for the Discord bot
 * @param {import('discord.js').Client} client - The Discord client instance
 */
export default function handlePresence(client) {
    // Check if presence is enabled in config
    if (!config.PRESENCE.ENABLED) {
        console.log("🚫 Presence updates are disabled in config");
        return;
    }

    // Check if client is ready
    if (!client.user) {
        console.log("⚠️ Client not ready, waiting for ready event...");
        client.once("ready", () => {
            console.log("✅ Client ready, starting presence updates...");
            startPresenceUpdates(client);
        });
        return;
    }

    // Client is ready, start presence updates immediately
    startPresenceUpdates(client);
}
