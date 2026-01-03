import { EmbedBuilder, PermissionFlagsBits, ChannelType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
  name: "unlock",
  description: "Unlock a channel to allow users to send messages",
  category: "MOD",
  botperms: ["ManageRoles"],
  userperms: ["ManageRoles"],
  cooldown: 3,
  aliases: ["unlockdown"],
  is_premium: false,
  usage: "unlock [channel] [reason]",

  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock a channel to allow users to send messages")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("The channel to unlock (defaults to current channel)")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for unlocking the channel")
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

      // Check if the channel type is valid for unlocking
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
            `${config.cross_emoji} | You can only unlock text channels, news channels, or forum channels.`
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

      // Check if channel is actually locked
      const currentPermissions = targetChannel.permissionOverwrites.cache.get(
        everyoneRole.id
      );
      if (
        !currentPermissions ||
        !currentPermissions.deny.has(PermissionFlagsBits.SendMessages)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | ${targetChannel} is not currently locked.`)
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Execute the unlock
      try {
        // Reset permissions to neutral (remove the deny overrides)
        await targetChannel.permissionOverwrites.edit(
          everyoneRole,
          {
            SendMessages: true,
            CreatePublicThreads: true,
            CreatePrivateThreads: true,
            SendMessagesInThreads: true,
            AddReactions: true,
          },
          {
            reason: `Channel unlocked by ${message.author.username} (${message.author.id}): ${reason}`,
          }
        );

        // Log the moderation action
        await logModerationAction(
          client,
          message.guild,
          'unlock',
          client.user,
          message.author,
          reason,
          null,
          { channelName: targetChannel.name, channelId: targetChannel.id }
        );

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(`${config.check_emoji} | ${targetChannel} has been unlocked successfully.`)
          .setFooter({
            text: `Unlocked by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        // Send confirmation message
        const confirmationMessage = await message.reply({
          embeds: [successEmbed],
        });
      } catch (error) {
        console.error("Error unlocking channel:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setTitle(`${config.cross_emoji} Unlock Failed`)
          .setDescription(
            `Failed to unlock ${targetChannel}. Please check my permissions and try again.`
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

        return message.reply({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Unlock command error:", error);

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

      // Check if the channel type is valid for unlocking
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
            `${config.cross_emoji} | You can only unlock text channels, news channels, or forum channels.`
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

      // Check if channel is already unlocked
      const currentPermissions = targetChannel.permissionOverwrites.cache.get(
        everyoneRole.id
      );
      if (
        !currentPermissions ||
        !currentPermissions.deny.has(PermissionFlagsBits.SendMessages)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | ${targetChannel} is already unlocked.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Execute the unlock
      try {
        await targetChannel.permissionOverwrites.edit(
          everyoneRole,
          {
            SendMessages: null,
            CreatePublicThreads: null,
            CreatePrivateThreads: null,
            SendMessagesInThreads: null,
            AddReactions: null,
          },
          {
            reason: `Channel unlocked by ${interaction.user.username} (${interaction.user.id}): ${reason}`,
          }
        );

        // Log the moderation action
        await logModerationAction(
          client,
          interaction.guild,
          'unlock',
          client.user,
          interaction.user,
          reason,
          null,
          { channelName: targetChannel.name, channelId: targetChannel.id }
        );

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | ${targetChannel} has been unlocked successfully.`
          )
          .setFooter({
            text: `Unlocked by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        // Send confirmation message
        await interaction.reply({
          embeds: [successEmbed],
        });
      } catch (error) {
        console.error("Error unlocking channel:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Failed to unlock ${targetChannel}. Please check my permissions and try again.`
          )
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      console.error("Unlock slash command error:", error);

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
