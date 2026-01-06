import {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
  name: "purge",
  description: "Clears a specified number of unpinned messages from the channel",
  category: "MOD",
  botperms: ["ManageMessages", "ReadMessageHistory"],
  userperms: ["ManageMessages"],
  cooldown: 5,
  is_premium: false,
  aliases: ["clear"],
  usage: "purge <amount> [user]",

  async execute(client, message, args) {
    try {
      // Check if amount is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide the number of messages to delete.\n\n**Usage:** `.purge <amount> [user]`\n**Range:** 2-2500 messages\n**Note:** Can only delete messages up to 14 days old"
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Parse amount
      const amount = parseInt(args[0]);

      if (isNaN(amount) || amount < 2 || amount > 2500) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide a valid number between **2 and 2500** for the number of messages to delete."
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Parse target user if provided
      let targetUser = null;
      if (args[1]) {
        const userId = args[1].replace(/[<@!>]/g, "");
        if (/^\d{17,19}$/.test(userId)) {
          try {
            targetUser = await client.users.fetch(userId);
          } catch (error) {
            const errorEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.ERROR)
              .setDescription(
                "The specified user was not found. Please check the user mention or ID."
              )
              .setFooter({
                text: `Requested by ${message.author.username}`,
                iconURL: message.author.displayAvatarURL(),
              });

            return message.reply({ embeds: [errorEmbed] });
          }
        }
      }

      const reason = `Purge by ${message.author.tag} (ID: ${message.author.id})`;

      // Show loading message
      const loadingMsg = await message.channel.send(
        `${config.loading_emoji} | Deleting up to ${amount} message${amount !== 1 ? "s" : ""}${targetUser ? ` from ${targetUser.tag}` : ""}...`
      );

      // Delete messages
      let totalDeleted = 0;
      let remainingToDelete = amount;
      const userMessageCount = new Map();
      let commandMessageDeleted = false;
      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      let oldMessagesSkipped = 0;
      let loadingMsgDeleted = false;

      while (remainingToDelete > 0) {
        // Fetch messages in batches
        const fetchLimit = Math.min(
          remainingToDelete + (commandMessageDeleted ? 0 : 1),
          100
        );
        const fetched = await message.channel.messages.fetch({
          limit: fetchLimit,
        });

        // Filter out pinned messages and apply user filter if specified
        let unpinnedMessages = Array.from(
          fetched.filter((m) => !m.pinned).values()
        );

        if (targetUser) {
          unpinnedMessages = unpinnedMessages.filter(
            (m) => m.author.id === targetUser.id
          );
        }

        if (unpinnedMessages.length === 0) {
          break; // No more messages to delete
        }

        let messagesToDelete = [];

        // Handle command message and loading message deletion on first iteration (only if no user filter)
        if (!commandMessageDeleted && !targetUser) {
          const otherMessages = unpinnedMessages.filter(
            (m) => m.id !== message.id && m.id !== loadingMsg.id
          );
          messagesToDelete = otherMessages.slice(
            0,
            Math.min(remainingToDelete, 97)
          );

          // Add command message and loading message if we have room
          if (messagesToDelete.length < 98 && !loadingMsgDeleted) {
            messagesToDelete.push(message);
            messagesToDelete.push(loadingMsg);
            commandMessageDeleted = true;
            loadingMsgDeleted = true;
          }
        } else {
          messagesToDelete = unpinnedMessages.filter(
            (m) => m.id !== loadingMsg.id
          ).slice(0, Math.min(remainingToDelete, 99));
        }

        if (messagesToDelete.length === 0) {
          break;
        }

        // Separate messages by age (14 days is Discord's bulk delete limit)
        const recentMessages = messagesToDelete.filter(
          (m) => m.createdTimestamp > fourteenDaysAgo
        );
        const oldMessages = messagesToDelete.filter(
          (m) => m.createdTimestamp <= fourteenDaysAgo
        );

        oldMessagesSkipped += oldMessages.length;

        // Bulk delete recent messages (under 14 days)
        if (recentMessages.length > 0) {
          try {
            await message.channel.bulkDelete(recentMessages).then((msgs) => {
              msgs.forEach((m) => {
                if (!userMessageCount.has(m.author.tag)) {
                  userMessageCount.set(m.author.tag, 0);
                }
                userMessageCount.set(
                  m.author.tag,
                  userMessageCount.get(m.author.tag) + 1
                );
              });
              totalDeleted += msgs.size;
            });
          } catch (bulkError) {
            // If bulk delete fails, delete individually
            for (const msg of recentMessages) {
              try {
                await msg.delete();
                if (!userMessageCount.has(msg.author.tag)) {
                  userMessageCount.set(msg.author.tag, 0);
                }
                userMessageCount.set(
                  msg.author.tag,
                  userMessageCount.get(msg.author.tag) + 1
                );
                totalDeleted++;
                await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
              } catch (deleteError) {
                // Silently skip messages that can't be deleted (already deleted, unknown message, etc.)
              }
            }
          }
        }

        remainingToDelete -= messagesToDelete.length;

        // Add a delay between batches to avoid rate limits
        if (remainingToDelete > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (totalDeleted === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `No unpinned messages found to delete${targetUser ? ` from ${targetUser.tag}` : ""}.${oldMessagesSkipped > 0 ? `\n\n**Note:** ${oldMessagesSkipped} message(s) were older than 14 days and cannot be deleted.` : ""}`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        // Delete loading message if it still exists
        if (!loadingMsgDeleted) {
          await loadingMsg.delete().catch(() => { });
        }

        const errorMsg = await message.channel.send({ embeds: [errorEmbed] });
        setTimeout(() => {
          errorMsg.delete().catch(() => { });
        }, 10000);
        return;
      }

      // Log the moderation action
      await logModerationAction(message.guild, 'purge', {
        moderator: message.author,
        target: targetUser || message.author,
        reason: `Deleted ${totalDeleted} messages`
      });

      // Delete loading message if it still exists
      if (!loadingMsgDeleted) {
        await loadingMsg.delete().catch(() => { });
      }

      // Build user message count string
      let logMessage = `${config.check_emoji} I have deleted ${totalDeleted} message${totalDeleted !== 1 ? "s" : ""}${targetUser ? ` from ${targetUser.tag}` : ""}.\n\n`;

      const sortedUsers = Array.from(userMessageCount.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      sortedUsers.forEach(([user, count]) => {
        logMessage += `**${user}** - ${count} message${count !== 1 ? "s" : ""} deleted\n`;
      });

      if (oldMessagesSkipped > 0) {
        logMessage += `\n*Note: ${oldMessagesSkipped} message(s) were older than 14 days and were skipped.*`;
      }

      const successMsg = await message.channel.send(logMessage);

      // Delete success message after 10 seconds
      setTimeout(() => {
        successMsg.delete().catch(() => { });
      }, 10000);
    } catch (error) {
      console.error("Error in purge command:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle(`${config.cross_emoji} An Error Occurred`)
        .setDescription(
          "An unexpected error occurred while trying to delete messages."
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      return message.reply({ embeds: [errorEmbed] });
    } 

  },
};
