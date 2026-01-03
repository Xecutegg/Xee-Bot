import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
  name: "ban",
  description: "Ban a user from the server",
  category: "MOD",
  botperms: ["BanMembers"],
  userperms: ["BanMembers"],
  cooldown: 3,
  aliases: ["b"],
  is_premium: false,
  usage: "ban <user> [reason]",

  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to ban").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for banning the user")
        .setRequired(false)
    ),

  async execute(client, message, args) {
    try {
      // Check if user ID or mention is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide a user to ban. **Usage:** `.ban <user> [reason]`"
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

      // Check if trying to ban themselves
      if (userId === message.author.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Chutiya h kya? You cannot ban yourself.");

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if trying to ban the bot
      if (userId === client.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Teri tara jhatu me khud ko hi ban kr lu? I cannot ban myself.");

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

      // Check if user is already banned
      try {
        const banList = await message.guild.bans.fetch();
        if (banList.has(userId)) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | **${targetUser.username}** is already banned from this server.`
            )
            .setFooter({
              text: `Requested by ${message.author.username}`,
              iconURL: message.author.displayAvatarURL(),
            });

          return message.reply({ embeds: [errorEmbed] });
        }
      } catch (error) {
        console.error("Error checking ban list:", error);
      }

      // Check if target member exists and role hierarchy
      if (targetMember) {
        // Check if target is server owner (MUST BE FIRST)
        if (targetMember.id === message.guild.ownerId) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription("Tere baba k server h na madarchod jo usko ban de rha h?? Apni Aukat Main Rhe!.")

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
              "tera and uska role same h nhi ban de sakta hu usko lawde!."
            );

          return message.reply({ embeds: [errorEmbed] });
        }

        // Check if bot can ban the target
        if (
          targetMember.roles.highest.position >=
          message.guild.members.me.roles.highest.position
        ) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              "Tera and uska role same h nhi ban de sakta hu usko lawde!."
            );

          return message.reply({ embeds: [errorEmbed] });
        }
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Banning **${targetUser.username}**...`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

      // Execute the ban
      try {
        await message.guild.members.ban(userId, {
          reason: `${reason} | Moderator: ${message.author.username} (${message.author.id})`,
          deleteMessageSeconds: 86400, // Delete messages from the last 24 hours
        });

        // Try to DM the user after successful ban
        let dmSent = false;
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `You have been banned from **${message.guild.name}** by **${message.author.username}**\n**Reason:** ${reason}`
            );

          await targetUser.send({ embeds: [dmEmbed] });
          dmSent = true;
        } catch (dmError) {
          // User has DMs disabled or other error
          console.log(
            `Could not DM user ${targetUser.username}: ${dmError.message}`
          );
        }

        // Log the moderation action
        await logModerationAction(
          client,
          message.guild,
          "ban",
          targetUser,
          message.author,
          reason,
          null,
          { dmSent: dmSent }
        );

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | **${targetUser.username}** has been banned from the server.`
          )
          .setFooter({
            text: `Banned by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        await loadingMessage.edit({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error banning user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to ban **${targetUser.username}**. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMessage.edit({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Ban command error:", error);

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
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      // Check if trying to ban themselves
      if (targetUser.id === interaction.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Chutiya h kya? You cannot ban yourself.")
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if trying to ban the bot
      if (targetUser.id === client.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Teri tara jhatu me khud ko hi ban kr lu? I cannot ban myself.")
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
          (await interaction.guild.members
            .fetch(targetUser.id)
            .catch(() => null));
      } catch (error) {
        // User might not be in the server
      }

      // Check if user is already banned
      try {
        const banList = await interaction.guild.bans.fetch();
        if (banList.has(targetUser.id)) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | **${targetUser.username}** is already banned from this server.`
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
      } catch (error) {
        console.error("Error checking ban list:", error);
      }

      // Check if target member exists and role hierarchy
      if (targetMember) {
        // Check if target is server owner (MUST BE FIRST)
        if (targetMember.id === interaction.guild.ownerId) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription("Tere baba k server h na? Apni Aukat Main Rhe!.")

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
              "You cannot ban a user with equal or higher role than you."
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

        // Check if bot can ban the target
        if (
          targetMember.roles.highest.position >=
          interaction.guild.members.me.roles.highest.position
        ) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              "tera and uska role same h nhi ban de sakta hu usko lawde!."
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
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Banning **${targetUser.username}**...`
        )
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [loadingEmbed] });

      // Execute the ban
      try {
        await interaction.guild.members.ban(targetUser.id, {
          reason: `${reason} | Moderator: ${interaction.user.username} (${interaction.user.id})`,
          deleteMessageSeconds: 86400, // Delete messages from the last 24 hours
        });

        // Try to DM the user after successful ban
        let dmSent = false;
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `You have been banned from **${interaction.guild.name}** by **${interaction.user.username}**\n**Reason:** ${reason}`
            );

          await targetUser.send({ embeds: [dmEmbed] });
          dmSent = true;
        } catch (dmError) {
          // User has DMs disabled or other error
          console.log(
            `Could not DM user ${targetUser.username}: ${dmError.message}`
          );
        }

        // Log the moderation action
        await logModerationAction(
          client,
          interaction.guild,
          "ban",
          targetUser,
          interaction.user,
          reason,
          null,
          { dmSent: dmSent }
        );

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | **${targetUser.username}** has been banned from the server.`
          )
          .setFooter({
            text: `Banned by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        await interaction.editReply({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error banning user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to ban **${targetUser.username}**. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Ban slash command error:", error);

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
