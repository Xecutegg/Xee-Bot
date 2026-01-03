import Guild from '../../database/models/Guild.js';

export default {
    name: 'sendupdates',
    devOnly: true, 
    category: 'ONLYDEVS',
    description: 'Send updates to all guilds private channels.',
    async execute(client, message, args) {

        if (!args.length) {
            return message.reply('Please provide a message to send.');
        }

        const updateMessage = args.join(' ');
    
        
        try {
            const guilds = await Guild.find({ private_channel: { $ne: null } });
            
            if (guilds.length === 0) {
                console.log('No guilds found');
                return message.reply('No guilds with private channels found.');
            }

            let successCount = 0;
            let failCount = 0;

            const statusMessage = await message.reply(`Starting to send updates to ${guilds.length} guilds...`);

            for (const guildData of guilds) {
                try {
                    const guild = client.guilds.cache.get(guildData.guildId);
                    if (!guild) {
                        failCount++;
                        continue;
                    }

                    const channel = guild.channels.cache.get(guildData.private_channel);
                    if (!channel) {
                        failCount++;
                        continue;
                    }

                    await channel.send(`${updateMessage}\n\n@everyone`);
                    successCount++;

                    // Rate limiting: wait 1 second between each message to respect Discord rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    failCount++;
                }
            }

            await statusMessage.edit(`✅ Update sent successfully!\n📊 **Stats:**\n• Successful: ${successCount}\n• Failed: ${failCount}\n• Total: ${guilds.length}`);

        } catch (error) {
            console.error('Error in sendupdates command:', error);
            message.reply('An error occurred while sending updates: ' + error.message);
        }
    }
};
