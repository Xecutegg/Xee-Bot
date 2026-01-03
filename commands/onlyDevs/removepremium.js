import { EmbedBuilder } from "discord.js";
import config from '../../config.js';
import Guild from '../../database/models/Guild.js';

export default {
  name: "removepremium",
  devOnly: true,
  category: "ONLYDEVS",
  description: "Remove premium from a guild",
  usage: "removepremium <guild_id>",
  aliases: ["rp"],

  async execute(client, message, args) {
    // Check if user is authorized
    if (!config.devs.includes(message.author.id)) {
      return message.reply('You do not have permission to use this command.');
    }

    if (args.length < 1) {
      return message.reply('Usage: `removepremium <guild_id>`');
    }

    const guildId = args[0];

    try {
      // Check if guild exists
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return message.reply(`Guild with ID \`${guildId}\` not found.`);
      }

      // Get guild data
      const guildData = await Guild.findOne({ guildId: guildId });
      if (!guildData) {
        return message.reply(`No database entry found for guild \`${guild.name}\` (${guildId}).`);
      }

      if (!guildData.is_premium) {
        return message.reply(`Guild \`${guild.name}\` (${guildId}) doesn't have premium.`);
      }

      // Remove premium
      guildData.is_premium = false;
      guildData.premium_end_time = null;
      guildData.premium_made_by = null;
      guildData.last_reminder_sent = null;

      await guildData.save();

      const embed = new EmbedBuilder()
        .setTitle('✅ Premium Removed Successfully')
        .setColor('#FF0000')
        .addFields(
          { name: 'Guild', value: `${guild.name} (${guildId})`, inline: true },
          { name: 'Status', value: 'Premium removed', inline: true },
          { name: 'Removed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp()
        .setFooter({
          text: `Removed by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error removing premium:', error);
      await message.reply('❌ An error occurred while removing premium. Please check the console for details.');
    }
  }
};
