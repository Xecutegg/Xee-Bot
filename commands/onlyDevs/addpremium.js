import { EmbedBuilder } from "discord.js";
import config from '../../config.js';
import Guild from '../../database/models/Guild.js';

export default {
  name: "addpremium",
  devOnly: true,
  category: "ONLYDEVS",
  description: "Add premium to a guild",
  usage: "addpremium <guild_id> <user_id> <duration_in_days>",
  aliases: ["ap"],

  async execute(client, message, args) {
    // Check if user is authorized
    if (!config.devs.includes(message.author.id)) {
      return message.reply('You do not have permission to use this command.');
    }

    if (args.length < 3) {
      return message.reply('Usage: `addpremium <guild_id> <user_id> <duration_in_days>`');
    }

    const guildId = args[0];
    const userId = args[1];
    const durationDays = parseInt(args[2]);

    if (isNaN(durationDays) || durationDays <= 0) {
      return message.reply('Duration must be a positive number of days.');
    }

    try {
      // Check if guild exists
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return message.reply(`Guild with ID \`${guildId}\` not found.`);
      }

      // Check if user exists
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) {
        return message.reply(`User with ID \`${userId}\` not found.`);
      }

      // Get or create guild data
      let guildData = await Guild.findOne({ guildId: guildId });
      if (!guildData) {
        guildData = new Guild({
          guildId: guildId,
          prefix: '!',
          private_channel: null,
          scrims_logs_channel: null,
          scrims_ban_logs_channel: null,
          scrim_mod_role: null,
          tourney_mod_role: null,
          tourney_logs_channel: null,
          mod_logs_channel: null,
          tag_check_ignore_role: null,
        });
      }

      // Calculate premium end time
      const premiumEndTime = new Date();
      premiumEndTime.setDate(premiumEndTime.getDate() + durationDays);

      // Update guild data
      guildData.is_premium = true;
      guildData.premium_end_time = premiumEndTime;
      guildData.premium_made_by = userId;
      guildData.last_reminder_sent = null;

      await guildData.save();

      const embed = new EmbedBuilder()
        .setTitle('✅ Premium Added Successfully')
        .setColor('#00FF00')
        .addFields(
          { name: 'Guild', value: `${guild.name} (${guildId})`, inline: true },
          { name: 'Added by User', value: `${user.tag} (${userId})`, inline: true },
          { name: 'Duration', value: `${durationDays} days`, inline: true },
          { name: 'Expires', value: `<t:${Math.floor(premiumEndTime.getTime() / 1000)}:F>`, inline: false }
        )
        .setTimestamp()
        .setFooter({
          text: `Added by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error adding premium:', error);
      await message.reply('❌ An error occurred while adding premium. Please check the console for details.');
    }
  }
};
