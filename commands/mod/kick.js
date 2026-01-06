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

export default {
  name: "kick",
  description: "Kick a user from the server",
  category: "MOD",
  botperms: ["KickMembers"],
  userperms: ["KickMembers"],
  cooldown: 3,
  aliases: ["k"],
  is_premium: false,
  usage: "kick <user> [reason]",

  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The user to kick")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for kicking the user")
        .setRequired(false)
    ),

  async execute(client, message, args) {
    try {
      // Check if user ID or mention is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide a user to kick. **Usage:** `.kick <user> [reason]`"
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Extract user ID from mention or direct ID
      const userId = args[0].replace(/[<@!>]/g, "");

      // Validate user ID format
      if (!/^\d{17,19}$/.test(userId)) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Please provide a valid user ID or mention.");

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get reason from remaining arguments
      const reason = args.slice(1).join(" ") || "No reason provided";

      // Check if trying to kick themselves
      if (userId === message.author.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("You cannot kick yourself.");

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if trying to kick the bot
      if (userId === client.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("I cannot kick myself.");

        return message.reply({ embeds: [errorEmbed] });
      }

      let targetUser;
      let targetMember;

      try {
        // Try to fetch user from Discord
        targetUser = await client.users.fetch(userId);
        targetMember =
          message.guild.members.cache.get(userId) ||
          (await message.guild.members.fetch(userId).catch(() => null));
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Could not find the specified user.");

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if target member exists in the guild
      if (!targetMember) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | **${targetUser.username}** is not a member of this server.`
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
            "You cannot kick a user with equal or higher role than you."
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if bot can kick the target
      if (
        targetMember.roles.highest.position >=
        message.guild.members.me.roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "I cannot kick a user with equal or higher role than me."
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if target is server owner
      if (targetMember.id === message.guild.ownerId) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Cannot kick the server owner.")
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Try to DM the user before kicking
      let dmSent = false;
      try {
        const dmContainer = new ContainerBuilder()
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `# You Have Been Kicked\n\n` +
                  `You have been kicked from **${message.guild.name}**\n\n` +
                  `**Moderator:** ${message.author.username}\n` +
                  `**Reason:** ${reason}`
                )
              )
              .setThumbnailAccessory(
                new ThumbnailBuilder().setURL(
                  message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
                )
              )
          );

        await targetUser.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2
        });
        dmSent = true;
      } catch (error) {
        // User has DMs disabled or other error, continue with kick
        console.log(
          `Could not DM user ${targetUser.username}: ${error.message}`
        );
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Kicking **${targetUser.username}**...`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

      // Execute the kick
      try {
        await targetMember.kick(
          `${reason} | Moderator: ${message.author.username} (${message.author.id})`
        );

        // Log the moderation action
        await logModerationAction(message.guild, 'kick', {
          moderator: message.author,
          target: targetUser,
          reason: reason
        });

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | **${targetUser.username}** has been kicked from the server.`
          )
          .setFooter({
            text: `Kicked by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        await loadingMessage.edit({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error kicking user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to kick **${targetUser.username}**. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMessage.edit({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Kick command error:", error);

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

  async executeSlash(client, interaction) {
    try {
      // Get options from slash command
      const targetUser = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason") || "No reason provided";

      // Check if trying to kick themselves
      if (targetUser.id === interaction.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("You cannot kick yourself.")
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if trying to kick the bot
      if (targetUser.id === client.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("I cannot kick myself.")
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      let targetMember;
      try {
        targetMember =
          interaction.guild.members.cache.get(targetUser.id) ||
          (await interaction.guild.members.fetch(targetUser.id).catch(() => null));
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Could not find the specified user.")
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if target member exists in the guild
      if (!targetMember) {
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
            "You cannot kick a user with equal or higher role than you."
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if bot can kick the target
      if (
        targetMember.roles.highest.position >=
        interaction.guild.members.me.roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "I cannot kick a user with equal or higher role than me."
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
          .setDescription("Cannot kick the server owner.")
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Try to DM the user before kicking
      let dmSent = false;
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `You have been kicked from **${interaction.guild.name}** by **${interaction.user.username}**`
          )
          .addFields({ name: "Reason", value: reason });

        await targetUser.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch (error) {
        // User has DMs disabled or other error, continue with kick
        console.log(
          `Could not DM user ${targetUser.username}: ${error.message}`
        );
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Kicking **${targetUser.username}**...`
        )
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [loadingEmbed] });

      // Execute the kick
      try {
        await targetMember.kick(
          `${reason} | Moderator: ${interaction.user.username} (${interaction.user.id})`
        );

        // Log the moderation action
        await logModerationAction(interaction.guild, 'kick', {
          moderator: interaction.user,
          target: targetUser,
          reason: reason
        });

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | **${targetUser.username}** has been kicked from the server.`
          )
          .setFooter({
            text: `Kicked by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        await interaction.editReply({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error kicking user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to kick **${targetUser.username}**. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Kick slash command error:", error);

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
