import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, MessageFlags } from "discord.js";
import { warnTarget } from "../../utils/ModUtils.js";
import config from "../../config.js";

export default {
  name: "warn",
  description: "Issue a warning to a member",
  category: "MOD",
  botperms: ["ModerateMembers"],
  userperms: ["ModerateMembers"],
  cooldown: 3,
  is_premium: false,
  usage: "warn <user> [reason]",

  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The user to warn")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for warning the user")
        .setRequired(false)
    ),

  async execute(client, message, args) {
    try {
      // Check if user is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a user to warn. **Usage:** \`.warn <user> [reason]\``
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Parse target user
      let targetMember;
      const userInput = args[0].replace(/[<@!>]/g, "");

      // Try to get member by ID or mention
      if (/^\d{17,19}$/.test(userInput)) {
        try {
          targetMember =
            message.guild.members.cache.get(userInput) ||
            (await message.guild.members.fetch(userInput));
        } catch (error) {
          // Member not found
        }
      }

      // If not found by ID, try by username
      if (!targetMember) {
        targetMember = message.guild.members.cache.find(
          (member) =>
            member.user.username.toLowerCase() === args[0].toLowerCase() ||
            member.displayName.toLowerCase() === args[0].toLowerCase()
        );
      }

      if (!targetMember) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | User not found. Please mention a valid user or provide their ID.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Extract reason from the remaining arguments
      const reason = args.slice(1).join(" ") || "No reason provided";

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Processing warning for **${targetMember.user.username}**...`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

      // Execute warning
      const result = await warnTarget(
        message.member,
        targetMember,
        reason,
        client
      );

      // Handle different result types
      if (result === "BOT_WARN") {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | You cannot warn bots.`)
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMsg.edit({ embeds: [errorEmbed] });
      }

      if (result === "SELF_WARN") {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | You cannot warn yourself.`)
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMsg.edit({ embeds: [errorEmbed] });
      }

      if (result === "MEMBER_PERM") {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You cannot warn **${targetMember.user.username}** because they have a higher or equal role than you.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMsg.edit({ embeds: [errorEmbed] });
      }

      if (result === "BOT_PERM") {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I don't have permission to moderate members.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMsg.edit({ embeds: [errorEmbed] });
      }

      if (result === "ERROR" || !result.success) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | An error occurred while warning **${targetMember.user.username}**.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMsg.edit({ embeds: [errorEmbed] });
      }

      // Success - Create response embed
      let description = `${config.check_emoji} | **${targetMember.user.username}** has been warned.\n\n`;
      description += `**Reason:** ${reason}\n`;
      description += `**Warnings:** ${result.warnings}/${result.maxWarnings}\n`;

      // If action was taken due to max warnings
      if (result.actionTaken && result.actionTaken.success) {
        description += `\n**Additional Action:** User was **${result.actionTaken.action}** for reaching maximum warnings.`;

        if (result.actionTaken.duration) {
          description += ` (Duration: ${result.actionTaken.duration})`;
        }
      } else if (result.actionTaken && !result.actionTaken.success) {
        description += `\n**Warning:** Could not execute automatic action (${result.actionTaken.error})`;
      }
      const successEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.SUCCESS)
        .setDescription(description)
        .setThumbnail(targetMember.user.displayAvatarURL())
        .addFields({
          name: "Target Information",
          value: `**User:** ${targetMember.user}\n**ID:** \`${targetMember.id}\`\n**Account Created:** <t:${Math.floor(targetMember.user.createdTimestamp / 1000)}:R>`,
          inline: false,
        })
        .setFooter({
          text: `Warned by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      await loadingMsg.edit({ embeds: [successEmbed] });

      // Try to send a DM to the warned user
      try {
        let dmDescription = `You have been warned in **${message.guild.name}**\n\n`;
        dmDescription += `**Reason:** ${reason}\n`;
        dmDescription += `**Warned by:** ${message.author.username}\n`;
        dmDescription += `**Total Warnings:** ${result.warnings}/${result.maxWarnings}`;

        const dmEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(dmDescription)
          .setThumbnail(message.guild.iconURL())
          .setFooter({
            text: `Warning ${result.warnings} of ${result.maxWarnings}`,
            iconURL: message.guild.iconURL(),
          });

        if (result.actionTaken && result.actionTaken.success) {
          dmEmbed.addFields({
            name: "**Maximum Warnings Reached**",
            value: `You have been **${result.actionTaken.action}** for reaching the maximum number of warnings (${result.maxWarnings}).`,
            inline: false,
          });
        }

        await targetMember.send({ embeds: [dmEmbed] });
      } catch (error) {
        // User has DMs disabled or blocked the bot - this is fine
      }
    } catch (error) {
      console.error("Error in warn command:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle(`${config.cross_emoji} An Error Occurred`)
        .setDescription(config.MESSAGES.COMMAND_ERROR)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      return message.reply({ embeds: [errorEmbed] });
    }
  },

  async executeSlash(client, interaction) {
    try {
      // Get options from slash command
      const targetUser = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason") || "No reason provided";

      // Get member object
      let targetMember;
      try {
        targetMember =
          interaction.guild.members.cache.get(targetUser.id) ||
          (await interaction.guild.members.fetch(targetUser.id));
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | User not found in this server.`
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
          `${config.loading_emoji} | Processing warning for **${targetMember.user.username}**...`
        )
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [loadingEmbed] });

      // Execute warning
      const result = await warnTarget(
        interaction.member,
        targetMember,
        reason,
        client
      );

      // Handle different result types
      if (result === "BOT_WARN") {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | You cannot warn bots.`)
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }

      if (result === "SELF_WARN") {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | You cannot warn yourself.`)
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }

      if (result === "MEMBER_PERM") {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You cannot warn **${targetMember.user.username}** because they have a higher or equal role than you.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }

      if (result === "BOT_PERM") {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I don't have permission to moderate members.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }

      if (result === "ERROR" || !result.success) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | An error occurred while warning **${targetMember.user.username}**.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }

      // Success - Create response embed
      let description = `${config.check_emoji} | **${targetMember.user.username}** has been warned.\n\n`;
      description += `**Reason:** ${reason}\n`;
      description += `**Warnings:** ${result.warnings}/${result.maxWarnings}\n`;

      // If action was taken due to max warnings
      if (result.actionTaken && result.actionTaken.success) {
        description += `\n**Additional Action:** User was **${result.actionTaken.action}** for reaching maximum warnings.`;

        if (result.actionTaken.duration) {
          description += ` (Duration: ${result.actionTaken.duration})`;
        }
      } else if (result.actionTaken && !result.actionTaken.success) {
        description += `\n**Warning:** Could not execute automatic action (${result.actionTaken.error})`;
      }

      const successEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.SUCCESS)
        .setDescription(description)
        .setThumbnail(targetMember.user.displayAvatarURL())
        .addFields({
          name: "Target Information",
          value: `**User:** ${targetMember.user}\n**ID:** \`${targetMember.id}\`\n**Account Created:** <t:${Math.floor(targetMember.user.createdTimestamp / 1000)}:R>`,
          inline: false,
        })
        .setFooter({
          text: `Warned by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({ embeds: [successEmbed] });

      // Try to send a DM to the warned user
      try {
        let dmDescription = `You have been warned in **${interaction.guild.name}**\n\n`;
        dmDescription += `**Reason:** ${reason}\n`;
        dmDescription += `**Warned by:** ${interaction.user.username}\n`;
        dmDescription += `**Total Warnings:** ${result.warnings}/${result.maxWarnings}`;

        const dmEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(dmDescription)
          .setThumbnail(interaction.guild.iconURL())
          .setFooter({
            text: `Warning ${result.warnings} of ${result.maxWarnings}`,
            iconURL: interaction.guild.iconURL(),
          });

        if (result.actionTaken && result.actionTaken.success) {
          dmEmbed.addFields({
            name: "**Maximum Warnings Reached**",
            value: `You have been **${result.actionTaken.action}** for reaching the maximum number of warnings (${result.maxWarnings}).`,
            inline: false,
          });
        }

        await targetMember.send({ embeds: [dmEmbed] });
      } catch (error) {
        // User has DMs disabled or blocked the bot - this is fine
      }
    } catch (error) {
      console.error("Error in warn slash command:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle(`${config.cross_emoji} An Error Occurred`)
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
