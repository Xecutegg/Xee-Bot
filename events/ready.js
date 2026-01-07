import handlePresence from '../utils/presenceHandler.js';
import initializePoru from '../handlers/poru.js';
import config from '../config.js';

export default {
    name: 'ready',
    once: true,
    execute(client) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Bot is online as ${client.user.tag}`);
        console.log(`📊 Servers: ${client.guilds.cache.size}`);
        console.log(`👥 Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`);
        console.log(`🎮 Commands: ${client.commands.size}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Initialize Poru music system
        if (config.MUSIC?.ENABLED) {
            initializePoru(client);
        }

        // Initialize presence handler
        handlePresence(client);
    },
};
