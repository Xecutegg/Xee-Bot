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
  name: "unban",
  description: "Unban a user from the server",
  category: "MOD",
  botperms: ["BanMembers"],
  userperms: ["BanMembers"],
  cooldown: 3,
  aliases: ["ub"],
  is_premium: false,
  usage: "unban <user_id> [reason]",

  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user from the server")
    .addStringOption(option =>
      option
        .setName("user_id")
        .setDescription("The user ID to unban")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for unbanning the user")
        .setRequired(false)
    ),

  async execute(client, message, args) {
    try {
      // Check if user ID is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide a user ID to unban. **Usage:** `.unban <@user_id> [reason]`"
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Extract user ID
      const userId = args[0].replace(/[<@!>]/g, "");

      // Validate user ID format
      if (!/^\d{17,19}$/.test(userId)) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a valid user or user ID (18-19 digits).`
          );

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get reason from remaining arguments
      const reason = args.slice(1).join(" ") || "No reason provided";

      // Check if user is actually banned
      let bannedUser;
      try {
        const banList = await message.guild.bans.fetch();
        bannedUser = banList.get(userId);

        if (!bannedUser) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | This user is not banned from the server.`
            )
            .setFooter({
              text: `Requested by ${message.author.username}`,
              iconURL: message.author.displayAvatarURL(),
            });

          return message.reply({ embeds: [errorEmbed] });
        }
      } catch (error) {
        console.error("Error fetching ban list:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to fetch the ban list. Please check my permissions.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Unbanning user...`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

      // Execute the unban
      try {
        await message.guild.members.unban(
          userId,
          `${reason} | Moderator: ${message.author.username} (${message.author.id})`
        );

        // Get user info for display
        let targetUser;
        try {
          targetUser = await client.users.fetch(userId);
        } catch (error) {
          // If we can't fetch the user, use the ban data
          targetUser = bannedUser.user;
        }

        // Log the moderation action
        await logModerationAction(message.guild, 'unban', {
          moderator: message.author,
          target: targetUser,
          reason: reason
        });

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | **${targetUser.username}** has been unbanned from the server.`
          )
          .setFooter({
            text: `Unbanned by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        await loadingMessage.edit({ embeds: [successEmbed] });

        // Try to DM the user about the unban
        try {
          const dmContainer = new ContainerBuilder()
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `# You Have Been Unbanned\n\n` +
                    `You have been unbanned from **${message.guild.name}**\n\n` +
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
        } catch (dmError) {
          // User has DMs disabled or other error, that's fine
          console.log(
            `Could not DM user ${targetUser.username}: ${dmError.message}`
          );
        }
      } catch (error) {
        console.error("Error unbanning user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to unban user with ID **${userId}**. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return loadingMessage.edit({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Unban command error:", error);

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
      const userId = interaction.options.getString("user_id");
      const reason = interaction.options.getString("reason") || "No reason provided";

      // Validate user ID format
      if (!/^\d{17,19}$/.test(userId)) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a valid user ID (18-19 digits).`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if user is actually banned
      let bannedUser;
      try {
        const banList = await interaction.guild.bans.fetch();
        bannedUser = banList.get(userId);

        if (!bannedUser) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | User with ID **${userId}** is not banned from this server.`
            )
            .setFooter({
              text: `Requested by ${interaction.user.username}`,
              iconURL: interaction.user.displayAvatarURL(),
            });

          return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
      } catch (error) {
        console.error("Error fetching ban list:", error);
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Unable to fetch ban list. Please check my permissions.`
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
          `${config.loading_emoji} | Unbanning **${bannedUser.user.username}**...`
        )
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [loadingEmbed] });

      try {
        // Execute the unban
        await interaction.guild.members.unban(
          userId,
          `${reason} | Moderator: ${interaction.user.username} (${interaction.user.id})`
        );

        // Log the moderation action
        await logModerationAction(interaction.guild, 'unban', {
          moderator: interaction.user,
          target: bannedUser.user,
          reason: reason
        });

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | **${bannedUser.user.username}** has been unbanned from the server.`
          )
          .setFooter({
            text: `Unbanned by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        await interaction.editReply({ embeds: [successEmbed] });

        // Try to DM the user
        try {
          const targetUser = await client.users.fetch(userId);
          const dmEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.SUCCESS)
            .setDescription(
              `You have been unbanned from **${interaction.guild.name}** by **${interaction.user.username}**`
            )
            .addFields({ name: "Reason", value: reason });

          await targetUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
          // User has DMs disabled or other error, that's fine
          console.log(
            `Could not DM user ${bannedUser.user.username}: ${dmError.message}`
          );
        }
      } catch (error) {
        console.error("Error unbanning user:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to unban user with ID **${userId}**. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.editReply({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Unban slash command error:", error);

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
