import config from '../config.js';

const cooldowns = new Map();

export default {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;

        // Check if message starts with prefix
        if (!message.content.startsWith(config.prefix)) return;

        // Parse command and arguments
        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Find command by name or alias
        const command = client.commands.get(commandName) ||
            client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        try {
            // Check bot permissions
            if (command.botperms) {
                const botMember = message.guild.members.cache.get(client.user.id);
                const missingPerms = command.botperms.filter(
                    perm => !botMember.permissions.has(perm)
                );

                if (missingPerms.length > 0) {
                    return message.reply({
                        content: `❌ I need the following permissions: ${missingPerms.join(', ')}`,
                        flags: 64
                    });
                }
            }

            // Check user permissions
            if (command.userperms) {
                const missingPerms = command.userperms.filter(
                    perm => !message.member.permissions.has(perm)
                );

                if (missingPerms.length > 0) {
                    return message.reply({
                        content: `${config.cross_emoji} | Chup Lawde Teri ma ki chut perms le kr aa ye wala \`${missingPerms.join(', ')}\``,
                        flags: 64
                    });
                }
            }

            // Check cooldown
            if (command.cooldown) {
                const now = Date.now();
                const cooldownKey = `${message.author.id}-${command.name}`;

                if (cooldowns.has(cooldownKey)) {
                    const expirationTime = cooldowns.get(cooldownKey) + (command.cooldown * 1000);

                    if (now < expirationTime) {
                        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
                        return message.reply({
                            content: `⏱ Please wait ${timeLeft}s before using this command again.`,
                            flags: 64
                        });
                    }
                }

                cooldowns.set(cooldownKey, now);
                setTimeout(() => cooldowns.delete(cooldownKey), command.cooldown * 1000);
            }

            // Execute command
            await command.execute(client, message, args);

        } catch (error) {
            console.error(`Error executing command ${command.name}:`, error);
            message.reply({
                content: '❌ An error occurred while executing this command.',
                flags: 64
            }).catch(console.error);
        }
    },
};
