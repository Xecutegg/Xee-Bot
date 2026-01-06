import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";
import ms from "ms";

export default {
  name: "timeout",
  description: "Timeout a user for a specified duration",
  category: "MOD",
  botperms: ["ModerateMembers"],
  userperms: ["ModerateMembers"],
  cooldown: 3,
  aliases: ["mute"],
  is_premium: false,
  usage: "timeout <user> <duration> [reason]",

  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user for a specified duration")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to timeout")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("Duration of the timeout (e.g., 1h, 30m, 2d)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for timing out the user")
        .setRequired(false)
    ),

  async execute(client, message, args) {
    try {
      // Check if user and duration are provided
      if (!args[0] || !args[1]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide a user and duration to timeout. **Usage:** `.timeout <user> <duration> [reason]`"
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Extract user ID from mention or direct ID
      const userId = args[0].replace(/[<@!>]/g, "");

      // Validate user ID format
      if (!/^\d{17,19}$/.test(userId)) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a valid user ID or mention.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Parse duration
      const duration = args[1];
      const durationMs = ms(duration);

      if (!durationMs || durationMs < 1000) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a valid duration. **Examples:** 30s, 10m, 2h, 1d`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Maximum timeout duration (28 days as per Discord limit)
      const maxDuration = 28 * 24 * 60 * 60 * 1000; // 28 days in milliseconds
      if (durationMs > maxDuration) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Maximum timeout duration is 28 days.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get reason from remaining arguments
      const reason = args.slice(2).join(" ") || "No reason provided";

      // Check if trying to timeout themselves
      if (userId === message.author.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You cannot timeout yourself.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if trying to timeout the bot
      if (userId === client.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | I cannot timeout myself.`)
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      let targetMember;
      try {
        targetMember =
          message.guild.members.cache.get(userId) ||
          (await message.guild.members.fetch(userId));
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Could not find the specified user in this server.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if target has higher or equal role
      if (
        targetMember.roles.highest.position >=
        message.member.roles.highest.position &&
        message.guild.ownerId !== message.author.id
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You cannot timeout a user with equal or higher role than you.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if bot can timeout the target
      if (
        targetMember.roles.highest.position >=
        message.guild.members.me.roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I cannot timeout a user with equal or higher role than me.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if target is server owner
      if (targetMember.id === message.guild.ownerId) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You Cannot give timeout to server owner.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if user is already timed out
      if (
        targetMember.communicationDisabledUntil &&
        targetMember.communicationDisabledUntil > new Date()
      ) {
        const currentTimeout = Math.floor(
          targetMember.communicationDisabledUntil.getTime() / 1000
        );
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | **${targetMember.user.username}** is already timed out until <t:${currentTimeout}:F>.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Try to DM the user before timing out
      let dmSent = false;
      try {
        const dmContainer = new ContainerBuilder()
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `# You Have Been Timed Out\n\n` +
                  `You have been timed out in **${message.guild.name}**\n\n` +
                  `**Moderator:** ${message.author.username}\n` +
                  `**Duration:** ${duration}\n` +
                  `**Expires:** <t:${Math.floor((Date.now() + durationMs) / 1000)}:F>\n` +
                  `**Reason:** ${reason}`
                )
              )
              .setThumbnailAccessory(
                new ThumbnailBuilder().setURL(
                  message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
                )
              )
          );

        await targetMember.user.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2
        });
        dmSent = true;
      } catch (error) {
        // User has DMs disabled or other error, continue with timeout
        console.log(
          `Could not DM user ${targetMember.user.username}: ${error.message}`
        );
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Timing out **${targetMember.user.username}** for ${duration}...`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

      // Execute the timeout
      try {
        await targetMember.timeout(
          durationMs,
          `${reason} | Moderator: ${message.author.username} (${message.author.id})`
        );

        const expiresAt = Math.floor((Date.now() + durationMs) / 1000);

        // Log the moderation action
        await logModerationAction(message.guild, 'timeout', {
          moderator: message.author,
          target: targetMember.user,
          reason: reason,
          duration: args[1]
        });

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(
            `${config.check_emoji} | **${targetMember.user.username}** has been timed out till <t:${expiresAt}:F>.`
          )
          .setFooter({
            text: `Timed out by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        await loadingMessage.edit({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error timing out user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setTitle(`${config.cross_emoji} Timeout Failed`)
          .setDescription(
            `Failed to timeout **${targetMember.user.username}**. Please check my permissions and try again.`
          )
          .addFields([
            {
              name: "Error",
              value: error.message || "Unknown error occurred",
              inline: false,
            },
          ])
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMessage.edit({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Timeout command error:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle(`${config.cross_emoji} Command Error`)
        .setDescription(config.MESSAGES.COMMAND_ERROR)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      await message.reply({ embeds: [errorEmbed] }).catch(() => { });
    }
  },

  async executeSlash(client, interaction) {
    try {
      // Get options from slash command
      const targetUser = interaction.options.getUser("user");
      const durationString = interaction.options.getString("duration");
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      // Parse duration
      const durationMs = ms(durationString);

      if (!durationMs || durationMs <= 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a valid duration (e.g., \`1h\`, \`30m\`, \`2d\`)`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if duration is within Discord's limits (max 28 days)
      const maxDuration = 28 * 24 * 60 * 60 * 1000; // 28 days in milliseconds
      if (durationMs > maxDuration) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Duration cannot exceed 28 days. Please provide a shorter duration.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if trying to timeout themselves
      if (targetUser.id === interaction.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You cannot timeout yourself.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if trying to timeout the bot
      if (targetUser.id === client.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | I cannot timeout myself.`)
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      let targetMember;
      try {
        targetMember =
          interaction.guild.members.cache.get(targetUser.id) ||
          (await interaction.guild.members.fetch(targetUser.id));
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | **${targetUser.username}** is not a member of this server.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if target has higher or equal role
      if (
        targetMember.roles.highest.position >=
        interaction.member.roles.highest.position &&
        interaction.guild.ownerId !== interaction.user.id
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You cannot timeout a user with equal or higher role than you.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if bot can timeout the target
      if (
        targetMember.roles.highest.position >=
        interaction.guild.members.me.roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I cannot timeout a user with equal or higher role than me.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if target is server owner
      if (targetMember.id === interaction.guild.ownerId) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Cannot timeout the server owner.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if user is already timed out
      if (
        targetMember.communicationDisabledUntil &&
        targetMember.communicationDisabledUntil > new Date()
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | **${targetUser.username}** is already timed out until <t:${Math.floor(targetMember.communicationDisabledUntil.getTime() / 1000)}:F>.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Try to DM the user before timing out
      let dmSent = false;
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(
            `You have been timed out in **${message.guild.name}** by **${message.author.username}** expiring in <t:${Math.floor((Date.now() + durationMs) / 1000)}:F>.`
          );

        await targetUser.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch (error) {
        // User has DMs disabled or other error, continue with timeout
        console.log(
          `Could not DM user ${targetUser.username}: ${error.message}`
        );
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Timing out **${targetUser.username}**...`
        )
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [loadingEmbed] });

      // Execute the timeout
      try {
        const expiresAt = Math.floor((Date.now() + durationMs) / 1000);
        await targetMember.timeout(
          durationMs,
          `${reason} | Moderator: ${interaction.user.username} (${interaction.user.id})`
        );

        // Log the moderation action
        await logModerationAction(interaction.guild, 'timeout', {
          moderator: interaction.user,
          target: targetUser,
          reason: reason,
          duration: durationString
        });

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(
            `${config.check_emoji} | **${targetUser.username}** has been timed out till <t:${expiresAt}:F>.`
          )
          .setFooter({
            text: `Timed out by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        await interaction.editReply({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error timing out user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setTitle(`${config.cross_emoji} Timeout Failed`)
          .setDescription(
            `Failed to timeout **${targetUser.username}**. Please check my permissions and try again.`
          )
          .addFields([
            {
              name: "Error",
              value: error.message || "Unknown error occurred",
              inline: false,
            },
          ])
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Timeout slash command error:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle(`${config.cross_emoji} Command Error`)
        .setDescription(config.MESSAGES.COMMAND_ERROR)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        console.error("Error sending error message:", replyError);
      }
    }
  },
};
