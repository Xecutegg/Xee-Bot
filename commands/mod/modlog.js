import { EmbedBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { getSettings } from "../../database/models/Guild.js";
import config from "../../config.js";

export default {
  name: "modlog",
  description: "Set up moderation logs channel for tracking all mod actions",
  category: "MOD",
  botperms: ["ViewChannel", "SendMessages", "EmbedLinks"],
  userperms: ["ManageGuild"],
  cooldown: 5,
  aliases: ["setmodlog", "modlogs"],
  is_premium: false,
  usage: "modlog <#channel | channel_id | disable>",

  async execute(client, message, args) {
    try {
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a channel or use \`disable\` to turn off modlogs.\n\n**Usage:** \`.modlog <#channel | channel_id | disable>\`\n\n**Examples:**\n\`.modlog #mod-logs\`\n\`.modlog disable\``
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      const guildData = await getSettings(message.guild);

      // Check if modlog is already setup (but allow disable and channel changes)
      if (guildData.mod_logs_channel && args[0].toLowerCase() !== "disable") {
        // Check if the existing channel still exists
        const existingChannel = message.guild.channels.cache.get(
          guildData.mod_logs_channel
        );

        if (existingChannel) {
          const alreadySetupEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.WARNING)
            .setDescription(
              `${config.info} | Moderation logs are already configured for this server.\n\n**Current Channel:** ${existingChannel}\n\n**Options:**\n${config.dot_emoji} Use \`.modlog disable\` to turn off modlogs\n${config.dot_emoji} Provide a different channel to change the modlog channel\n${config.dot_emoji} Use the same channel again to confirm setup`
            )
            .setFooter({
              text: `Requested by ${message.author.username}`,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTimestamp();

          // Check if user is trying to set the same channel again
          const newChannelId = args[0].replace(/[<#>]/g, "");
          if (newChannelId === guildData.mod_logs_channel) {
            return message.reply({
              embeds: [
                alreadySetupEmbed.setDescription(
                  `${config.check_emoji} This channel is already set as the moderation logs channel.\n\n**Current Channel:** ${existingChannel}.`
                ),
              ],
            });
          }

          return message.reply({ embeds: [alreadySetupEmbed] });
        } else {
          // Channel was deleted, clear it from database
          guildData.mod_logs_channel = null;
          await guildData.save();
        }
      }

      // Check if user wants to disable modlogs
      if (args[0].toLowerCase() === "disable") {
        guildData.mod_logs_channel = null;
        await guildData.save();

        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | Moderation logs have been **disabled** for this server.`
          )
          .setFooter({
            text: `Disabled by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [successEmbed] });
      }

      // Extract channel ID from mention or direct ID
      let channelId = args[0].replace(/[<#>]/g, "");

      // Validate channel ID format
      if (!/^\d{17,19}$/.test(channelId)) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a valid channel mention or ID.`
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get the channel
      const channel = message.guild.channels.cache.get(channelId);
      if (!channel) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Channel not found. Please make sure the channel exists in this server.`
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if it's a text channel
      if (channel.type !== ChannelType.GuildText) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a text channel for moderation logs.`
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check bot permissions in the channel
      const botMember = message.guild.members.cache.get(client.user.id);
      const permissions = channel.permissionsFor(botMember);

      if (
        !permissions.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
        ])
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I don't have the required permissions in ${channel}.\n\n**Required Permissions:**\n• View Channel\n• Send Messages\n• Embed Links`
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Update database
      guildData.mod_logs_channel = channelId;
      await guildData.save();

      // Send confirmation embed
      const successEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.SUCCESS)
        .setTitle(`${config.mod_emoji} Moderation Logs Setup Complete`)
        .setDescription(
          `${config.check_emoji} | Moderation logs channel has been set to ${channel}\n\n**What will be logged:**\n${config.dot_emoji} Ban/Unban actions\n${config.dot_emoji} Kick actions\n${config.dot_emoji} Timeout/Untimeout actions\n${config.dot_emoji} Warning/Remove warning actions\n${config.dot_emoji} Role add/remove actions\n${config.dot_emoji} Channel lock/unlock actions\n${config.dot_emoji} Channel hide/unhide actions\n\n**Features:**\n${config.dot_emoji} Full user and moderator information\n${config.dot_emoji} Timestamps and reasons\n${config.dot_emoji} Duration for temporary actions\n${config.dot_emoji} User avatars and IDs for easy identification`
        )
        .setFooter({
          text: `Set by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      await message.reply({ embeds: [successEmbed] });

      // Send a test log to the channel
      const testEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.BOT_EMBED)
        .setDescription(
          `${config.check_emoji} | This channel has been configured to receive moderation logs.\n\nAll moderation actions performed using **${client.user.username}** commands will be logged here with full details.`
        )
        .setFooter({
          text: `Setup completed by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      await channel.send({ embeds: [testEmbed] });
    } catch (error) {
      console.error("Modlog command error:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setDescription(config.MESSAGES.COMMAND_ERROR)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      await message.reply({ embeds: [errorEmbed] }).catch(() => { });
    }
  },
};
