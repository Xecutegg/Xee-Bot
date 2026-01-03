// Simple cooldown management using Map
const cooldowns = new Map();

/**
 * Apply cooldown to user for a command
 * @param {string} userId 
 * @param {string} commandName 
 * @param {number} cooldownTime - in seconds
 * @returns {number|null} - remaining cooldown time in milliseconds or null if no cooldown
 */
export const applyCooldown = (userId, commandName, cooldownTime) => {
    if (!cooldownTime || cooldownTime <= 0) return null;

    const key = `${userId}-${commandName}`;
    const now = Date.now();
    const cooldownAmount = cooldownTime * 1000;

    if (cooldowns.has(key)) {
        const expirationTime = cooldowns.get(key) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = expirationTime - now;
            return timeLeft;
        }
    }

    cooldowns.set(key, now);
    setTimeout(() => cooldowns.delete(key), cooldownAmount);

    return null;
};

/**
 * Clear cooldown for user on a command
 * @param {string} userId 
 * @param {string} commandName 
 */
export const clearCooldown = (userId, commandName) => {
    const key = `${userId}-${commandName}`;
    cooldowns.delete(key);
};

/**
 * Get remaining cooldown time
 * @param {string} userId 
 * @param {string} commandName 
 * @param {number} cooldownTime - in seconds
 * @returns {number} - remaining time in milliseconds
 */
export const getCooldown = (userId, commandName, cooldownTime) => {
    const key = `${userId}-${commandName}`;
    const now = Date.now();
    const cooldownAmount = cooldownTime * 1000;

    if (cooldowns.has(key)) {
        const expirationTime = cooldowns.get(key) + cooldownAmount;
        if (now < expirationTime) {
            return expirationTime - now;
        }
    }

    return 0;
};
