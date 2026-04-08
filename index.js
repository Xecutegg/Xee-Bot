import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import setupDatabase from './database/index.js';
import initializePoru from './handlers/poru.js';

dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, // Required for music
    ],
});

// Initialize commands collection
client.commands = new Collection();

// Initialize Poru music system
client.once('ready', () => {
    initializePoru(client);
});

// Setup database (optional - only if MONGO_URI is provided)
if (process.env.MONGO_URI) {
    setupDatabase(process.env.MONGO_URI).catch(err => {
        console.error('⚠️ Database connection failed, continuing without database features');
    });
}

// Load commands
const loadCommands = () => {
    const commandsPath = join(__dirname, 'commands');
    const commandItems = readdirSync(commandsPath, { withFileTypes: true });

    for (const item of commandItems) {
        if (item.isDirectory()) {
            const folderPath = join(commandsPath, item.name);
            const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = join(folderPath, file);
                import(`file://${filePath}`).then(commandModule => {
                    const command = commandModule.default;
                    if (command.name) {
                        client.commands.set(command.name, command);
                        console.log(`✅ Loaded command: ${command.name}`);
                    }
                }).catch(err => {
                    console.error(`❌ Error loading command ${file}:`, err);
                });
            }
        } else if (item.isFile() && item.name.endsWith('.js')) {
            // Load command files directly in commands folder
            const filePath = join(commandsPath, item.name);
            import(`file://${filePath}`).then(commandModule => {
                const command = commandModule.default;
                if (command.name) {
                    client.commands.set(command.name, command);
                    console.log(`✅ Loaded command: ${command.name}`);
                }
            }).catch(err => {
                console.error(`❌ Error loading command ${item.name}:`, err);
            });
        }
    }
};

// Load events
const loadEvents = () => {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = join(eventsPath, file);
        import(`file://${filePath}`).then(eventModule => {
            const event = eventModule.default;
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
            console.log(`✅ Loaded event: ${event.name}`);
        }).catch(err => {
            console.error(`❌ Error loading event ${file}:`, err);
        });
    }
};

// Initialize bot
loadCommands();
loadEvents();

// Login
client.login(process.env.TOKEN).catch(err => {
    console.error('❌ Failed to login:', err);
    process.exit(1);
});
