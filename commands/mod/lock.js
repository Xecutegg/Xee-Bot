import { EmbedBuilder, PermissionFlagsBits, ChannelType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
  name: "lock",
  description: "Lock a channel to prevent users from sending messages",
  category: "MOD",
  botperms: ["ManageRoles"],
  userperms: ["ManageRoles"],
  cooldown: 3,
  aliases: ["lockdown"],
  is_premium: false,
  usage: "lock [channel] [reason]",

  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock a channel to prevent users from sending messages")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("The channel to lock (defaults to current channel)")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for locking the channel")
        .setRequired(false)
    ),

  async execute(client, message, args) {
    try {
      // Determine target channel
      let targetChannel = message.channel;
      let reason = args.join(" ") || "No reason provided";

      // Check if first argument is a channel mention or ID
      if (args[0]) {
        const channelId = args[0].replace(/[<#>]/g, "");
        if (/^\d{17,19}$/.test(channelId)) {
          try {
            const fetchedChannel =
              message.guild.channels.cache.get(channelId) ||
              (await message.guild.channels.fetch(channelId));
            if (fetchedChannel) {
              targetChannel = fetchedChannel;
              reason = args.slice(1).join(" ") || "No reason provided";
            }
          } catch (error) {
            // Invalid channel ID, treat as reason
          }
        }
      }

      // Check if the channel type is valid for locking
      if (
        ![
          ChannelType.GuildText,
          ChannelType.GuildNews,
          ChannelType.GuildForum,
        ].includes(targetChannel.type)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You can only lock text channels, news channels, or forum channels.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if bot has permissions to manage the target channel
      if (
        !targetChannel
          .permissionsFor(message.guild.members.me)
          .has(PermissionFlagsBits.ManageChannels)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I don't have permission to manage ${targetChannel}.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if user has permissions to manage the target channel
      if (
        !targetChannel
          .permissionsFor(message.member)
          .has(PermissionFlagsBits.ManageChannels) &&
        message.guild.ownerId !== message.author.id
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You don't have permission to manage ${targetChannel}.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get the @everyone role
      const everyoneRole = message.guild.roles.everyone;

      // Check if channel is already locked
      const currentPermissions = targetChannel.permissionOverwrites.cache.get(
        everyoneRole.id
      );
      if (
        currentPermissions &&
        currentPermissions.deny.has(PermissionFlagsBits.SendMessages)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | ${targetChannel} is already locked.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Execute the lock
      try {
        await targetChannel.permissionOverwrites.edit(
          everyoneRole,
          {
            SendMessages: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            SendMessagesInThreads: false,
            AddReactions: false,
          },
          {
            reason: `Channel locked by ${message.author.username} (${message.author.id}): ${reason}`,
          }
        );

        // Log the moderation action
        await logModerationAction(message.guild, 'lock', {
          moderator: message.author,
          target: targetChannel,
          reason: reason
        });

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(
            `${config.check_emoji} | ${targetChannel} has been locked successfully.`
          )
          .setFooter({
            text: `Locked by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        // Send confirmation message
        const confirmationMessage = await message.reply({
          embeds: [successEmbed],
        });
      } catch (error) {
        console.error("Error locking channel:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to lock ${targetChannel}. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Lock command error:", error);

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
      const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
      const reason = interaction.options.getString("reason") || "No reason provided";

      // Check if the channel type is valid for locking
      if (
        ![
          ChannelType.GuildText,
          ChannelType.GuildNews,
          ChannelType.GuildForum,
        ].includes(targetChannel.type)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You can only lock text channels, news channels, or forum channels.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if bot has permissions to manage the target channel
      if (
        !targetChannel
          .permissionsFor(interaction.guild.members.me)
          .has(PermissionFlagsBits.ManageChannels)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | I don't have permission to manage ${targetChannel}.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Check if user has permissions to manage the target channel
      if (
        !targetChannel
          .permissionsFor(interaction.member)
          .has(PermissionFlagsBits.ManageChannels) &&
        interaction.guild.ownerId !== interaction.user.id
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You don't have permission to manage ${targetChannel}.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Get the @everyone role
      const everyoneRole = interaction.guild.roles.everyone;

      // Check if channel is already locked
      const currentPermissions = targetChannel.permissionOverwrites.cache.get(
        everyoneRole.id
      );
      if (
        currentPermissions &&
        currentPermissions.deny.has(PermissionFlagsBits.SendMessages)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | ${targetChannel} is already locked.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Execute the lock
      try {
        await targetChannel.permissionOverwrites.edit(
          everyoneRole,
          {
            SendMessages: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            SendMessagesInThreads: false,
            AddReactions: false,
          },
          {
            reason: `Channel locked by ${interaction.user.username} (${interaction.user.id}): ${reason}`,
          }
        );

        // Log the moderation action
        await logModerationAction(interaction.guild, 'lock', {
          moderator: interaction.user,
          target: targetChannel,
          reason: reason
        });

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(
            `${config.check_emoji} | ${targetChannel} has been locked successfully.`
          )
          .setFooter({
            text: `Locked by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        // Send confirmation message
        await interaction.reply({
          embeds: [successEmbed],
        });
      } catch (error) {
        console.error("Error locking channel:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to lock ${targetChannel}. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      console.error("Lock slash command error:", error);

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
