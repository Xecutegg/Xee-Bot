import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, MessageFlags } from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
  name: "untimeout",
  description: "Remove timeout from a user",
  category: "MOD",
  botperms: ["ModerateMembers"],
  userperms: ["ModerateMembers"],
  cooldown: 3,
  aliases: ["unmute"],
  is_premium: false,
  usage: "untimeout <user> [reason]",

  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout from a user")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The user to remove timeout from")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for removing the timeout")
        .setRequired(false)
    ),

  async execute(client, message, args) {
    try {
      // Check if user is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a user to remove timeout from.\n\n**Usage:** `
              .untimeout <
            user >
            [reason]``
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

      // Get reason from remaining arguments
      const reason = args.slice(1).join(" ") || "No reason provided";

      // Check if trying to untimeout themselves
      if (userId === message.author.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You cannot remove timeout from yourself.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if trying to untimeout the bot
      if (userId === client.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | I am not timed out.`)
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

      // Check if user is actually timed out
      if (
        !targetMember.communicationDisabledUntil ||
        targetMember.communicationDisabledUntil <= new Date()
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | **${targetMember.user.username}** is not currently timed out.`
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
            `${config.cross_emoji} | You cannot remove timeout from a user with equal or higher role than you.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if bot can untimeout the target
      if (
        targetMember.roles.highest.position >=
        message.guild.members.me.roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I cannot remove timeout from a user with equal or higher role than me.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Store the original timeout end time for logging
      const originalTimeoutEnd = Math.floor(
        targetMember.communicationDisabledUntil.getTime() / 1000
      );

      // Try to DM the user before removing timeout
      let dmSent = false;
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `Your timeout has been removed in **${message.guild.name}** by **${message.author.username}**`
          );

        await targetMember.user.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch (error) {
        // User has DMs disabled or other error, continue with untimeout
        console.log(
          `Could not DM user ${targetMember.user.username}: ${error.message}`
        );
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Removing timeout from **${targetMember.user.username}**...`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

      // Execute the untimeout
      try {
        await targetMember.timeout(
          null,
          `${reason} | Moderator: ${message.author.username} (${message.author.id})`
        );

        // Log the moderation action
        await logModerationAction(
          client,
          message.guild,
          'untimeout',
          targetMember.user,
          message.author,
          reason,
          null,
          { dmSent: dmSent, originalTimeoutEnd: originalTimeoutEnd }
        );

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | **${targetMember.user.username}**'s timeout has been removed.`
          )
          .setFooter({
            text: `Timeout removed by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        await loadingMessage.edit({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error removing timeout from user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to remove timeout from **${targetMember.user.username}**. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMessage.edit({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Untimeout command error:", error);

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
      const reason = interaction.options.getString("reason") || "No reason provided";

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

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
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
            `${config.cross_emoji} | You cannot remove timeout from a user with equal or higher role than you.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if bot can manage the target
      if (
        targetMember.roles.highest.position >=
        interaction.guild.members.me.roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I cannot remove timeout from a user with equal or higher role than me.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if target is server owner
      if (targetMember.id === interaction.guild.ownerId) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | Cannot manage the server owner.`)
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if user is actually timed out
      if (!targetMember.communicationDisabledUntil || targetMember.communicationDisabledUntil <= new Date()) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | **${targetUser.username}** is not currently timed out.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Removing timeout from **${targetUser.username}**...`
        )
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [loadingEmbed] });

      try {
        // Remove the timeout
        await targetMember.timeout(
          null,
          `${reason} | Moderator: ${interaction.user.username} (${interaction.user.id})`
        );

        // Log the moderation action
        await logModerationAction(
          client,
          interaction.guild,
          'untimeout',
          targetUser,
          interaction.user,
          reason
        );

        // Try to DM the user
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.SUCCESS)
            .setDescription(
              `Your timeout has been removed in **${interaction.guild.name}** by **${interaction.user.username}**`
            )
            .addFields({ name: "Reason", value: reason });

          await targetUser.send({ embeds: [dmEmbed] });
        } catch (error) {
          // User has DMs disabled or other error, continue
          console.log(
            `Could not DM user ${targetUser.username}: ${error.message}`
          );
        }

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | **${targetUser.username}**'s timeout has been removed.`
          )
          .setFooter({
            text: `Timeout removed by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        await interaction.editReply({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error removing timeout from user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to remove timeout from **${targetUser.username}**. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Untimeout slash command error:", error);

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
          await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
      } catch (replyError) {
        console.error("Error sending error message:", replyError);
      }
    }
  },
};
