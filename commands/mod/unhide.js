import { EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
  name: "unhide",
  description: "Unhide a channel for specified roles or @everyone",
  category: "MOD",
  botperms: ["ManageRoles"],
  userperms: ["ManageRoles"],
  cooldown: 3,
  aliases: ["unhidechannel"],
  is_premium: false,
  usage: "unhide [channel] [roles] [reason]",

  async execute(client, message, args) {
    try {
      // Determine target channel
      let targetChannel = message.channel;
      let targetRoles = [message.guild.roles.everyone];
      let reason = "No reason provided";
      let argIndex = 0;

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
              argIndex = 1;
            }
          } catch (error) {
            // Invalid channel ID, continue with current channel
          }
        }
      }

      // Parse roles and reason from remaining arguments
      const remainingArgs = args.slice(argIndex);
      const roleArgs = [];
      const reasonArgs = [];
      let foundReason = false;

      for (let i = 0; i < remainingArgs.length; i++) {
        const arg = remainingArgs[i];

        // Check if this looks like a role mention or ID
        const roleId = arg.replace(/[<@&>]/g, "");
        if (/^\d{17,19}$/.test(roleId) && !foundReason) {
          const role = message.guild.roles.cache.get(roleId);
          if (role) {
            roleArgs.push(role);
            continue;
          }
        }

        // If we've found role arguments and this isn't a role, treat the rest as reason
        if (roleArgs.length > 0 || foundReason) {
          foundReason = true;
          reasonArgs.push(arg);
        } else {
          // If no roles found yet, treat as reason
          reasonArgs.push(arg);
          foundReason = true;
        }
      }

      // Set target roles and reason
      if (roleArgs.length > 0) {
        targetRoles = roleArgs;
      }
      if (reasonArgs.length > 0) {
        reason = reasonArgs.join(" ");
      }

      // Check if the channel type is valid for unhiding
      if (
        ![
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildNews,
          ChannelType.GuildForum,
          ChannelType.GuildCategory,
        ].includes(targetChannel.type)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | You can only unhide text channels, voice channels, news channels, forum channels, or categories.`
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
          .setDescription(`${config.cross_emoji} | I don't have permission to manage ${targetChannel}.`)
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

      // Check if any of the target roles are actually hidden from the channel
      const hiddenRoles = [];
      const notHiddenRoles = [];

      for (const role of targetRoles) {
        const currentPermissions = targetChannel.permissionOverwrites.cache.get(
          role.id
        );
        if (
          currentPermissions &&
          currentPermissions.deny.has(PermissionFlagsBits.ViewChannel)
        ) {
          hiddenRoles.push(role);
        } else {
          notHiddenRoles.push(role);
        }
      }

      if (hiddenRoles.length === 0) {
        const rolesList = targetRoles.map((role) => role.name).join(", ");
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | ${targetChannel} is not currently hidden from: ${rolesList}`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Execute the unhide operation
      try {
        const unhiddenRoles = [];
        const failedRoles = [];

        for (const role of hiddenRoles) {
          try {
            await targetChannel.permissionOverwrites.edit(
              role,
              {
                ViewChannel: true, // Explicitly allow viewing the channel
              },
              {
                reason: `Channel unhidden for ${role.name} by ${message.author.username} (${message.author.id}): ${reason}`,
              }
            );
            unhiddenRoles.push(role);
          } catch (error) {
            console.error(
              `Error unhiding channel for role ${role.name}:`,
              error
            );
            failedRoles.push(role);
          }
        }

        if (unhiddenRoles.length === 0) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | Failed to unhide ${targetChannel} for any of the specified roles.`
            )
            .setFooter({
              text: `Requested by ${message.author.username}`,
              iconURL: message.author.displayAvatarURL(),
            });

          return message.reply({ embeds: [errorEmbed] });
        }

        // Log the moderation action
        await logModerationAction(message.guild, 'unhide', {
          moderator: message.author,
          target: targetChannel,
          reason: reason
        });

        // Success embed
        const unhiddenRolesList = unhiddenRoles
          .map((role) => role.name)
          .join(", ");
        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(`${config.check_emoji} | ${targetChannel} has been unhidden successfully.`)
          .setFooter({
            text: `Unhidden by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        if (failedRoles.length > 0) {
          const failedRolesList = failedRoles
            .map((role) => role.name)
            .join(", ");
          successEmbed.addFields([
            {
              name: "⚠️ Failed to Unhide For",
              value: failedRolesList,
              inline: false,
            },
          ]);
        }

        if (notHiddenRoles.length > 0) {
          const notHiddenRolesList = notHiddenRoles
            .map((role) => role.name)
            .join(", ");
          successEmbed.addFields([
            {
              name: "ℹ️ Was Not Hidden For",
              value: notHiddenRolesList,
              inline: false,
            },
          ]);
        }

        await message.reply({ embeds: [successEmbed] });
      } catch (error) {
        console.error("Error unhiding channel:", error);

        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setTitle(`${config.cross_emoji} Unhide Failed`)
          .setDescription(
            `Failed to unhide ${targetChannel}. Please check my permissions and try again.`
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
      console.error("Unhide command error:", error);

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
};
