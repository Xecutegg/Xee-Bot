import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { getMember, clearWarnings } from "../../database/models/Member.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
  name: "clearwarnings",
  description: "Clear all warnings from a user",
  category: "MOD",
  botperms: ["ViewChannel", "SendMessages", "EmbedLinks"],
  userperms: ["ManageGuild"], // Higher permission required for clearing all warnings
  cooldown: 5,
  aliases: ["clearwarns", "resetwarnings"],
  is_premium: false,
  usage: "clearwarnings <user>",

  async execute(client, message, args) {
    try {
      // Check if user is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a user to clear warnings for.\n\n**Usage:** \`.clearwarnings <user>\``
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

      // Check if user is a bot
      if (targetMember.user.bot) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(`${config.cross_emoji} | Bots cannot have warnings.`)
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get member data
      const memberData = await getMember(message.guild.id, targetMember.id);

      // Check if user has any warnings
      if (memberData.warnings === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | **${targetMember.user.username}** has no warnings to clear.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Create confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `Are you sure you want to clear **All ${memberData.warnings} warning(s)** from **${targetMember.user.username}**?\n`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId(`clearwarn_confirm_${message.author.id}_${Date.now()}`)
        .setLabel("Clear All Warnings")
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`clearwarn_cancel_${message.author.id}_${Date.now()}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary);

      const actionRow = new ActionRowBuilder().addComponents(
        confirmButton,
        cancelButton
      );

      const confirmMsg = await message.reply({
        embeds: [confirmEmbed],
        components: [actionRow],
      });

      // Handle button interactions
      const collector = confirmMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000, // 1 minute
        filter: (i) => {
          if (i.user.id !== message.author.id) {
            i.reply({
              content: `Only the command author (<@${message.author.id}>) can use these buttons.`,
              flags: 64,
            }).catch(console.error);
            return false;
          }
          return true;
        },
      });

      collector.on("collect", async (interaction) => {
        try {
          if (interaction.customId.includes("clearwarn_cancel_")) {
            const cancelledEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.ERROR)
              .setDescription(
                `${config.cross_emoji} | Warning clearance cancelled.`
              )
              .setFooter({
                text: `Cancelled by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
              });

            await interaction.update({
              embeds: [cancelledEmbed],
              components: [],
            });
            return;
          }

          if (interaction.customId.includes("clearwarn_confirm_")) {
            // Show loading state
            const loadingButton = new ButtonBuilder()
              .setCustomId(`clearwarn_loading_${Date.now()}`)
              .setLabel("Clearing warnings...")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true);

            const loadingRow = new ActionRowBuilder().addComponents(
              loadingButton
            );

            await interaction.update({ components: [loadingRow] });

            try {
              const clearedWarnings = memberData.warnings;

              // Clear all warnings
              await clearWarnings(message.guild.id, targetMember.id);

              // Log the action
              await logModerationAction(message.guild, 'clearwarnings', {
                moderator: interaction.user,
                target: targetMember.user,
                reason: `Cleared all warnings`
              });

              // Success embed
              const successEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setDescription(
                  `${config.check_emoji} | Successfully cleared all **${clearedWarnings} warning(s)** from **${targetMember.user.username}** **Current Warnings Is Now:** 0`
                )
                .setFooter({
                  text: `Cleared by ${interaction.user.username}`,
                  iconURL: interaction.user.displayAvatarURL(),
                });

              await interaction.editReply({
                embeds: [successEmbed],
                components: [],
              });

              // Try to send a DM to the user
              try {
                const dmEmbed = new EmbedBuilder()
                  .setColor(config.EMBED_COLORS.SUCCESS)
                  .setDescription(
                    `All your warnings have been cleared in **${message.guild.name}**`
                  )
                  .setFooter({
                    text: `Warnings cleared by ${message.author.name}`,
                    iconURL: message.guild.iconURL(),
                  });

                await targetMember.send({ embeds: [dmEmbed] });
              } catch (error) {
                // User has DMs disabled or blocked the bot - this is fine
              }
            } catch (error) {
              console.error("Error clearing warnings:", error);

              const errorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setDescription(
                  `${config.cross_emoji} | An error occurred while clearing warnings.`
                )
                .setFooter({
                  text: `Requested by ${interaction.user.username}`,
                  iconURL: interaction.user.displayAvatarURL(),
                });

              await interaction.editReply({
                embeds: [errorEmbed],
                components: [],
              });
            }
          }
        } catch (error) {
          console.error("Error handling button interaction:", error);
          try {
            await interaction.reply({
              content: "An error occurred while processing your request.",
              flags: 64,
            });
          } catch (replyError) {
            console.error("Could not send error reply:", replyError);
          }
        }
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          try {
            const timeoutEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.ERROR)
              .setDescription(
                `${config.cross_emoji} | Warning clearance timed out. Please try again.`
              )
              .setFooter({
                text: `Requested by ${message.author.username}`,
                iconURL: message.author.displayAvatarURL(),
              });

            await confirmMsg.edit({
              embeds: [timeoutEmbed],
              components: [],
            });
          } catch (error) {
            // Message might be deleted
          }
        }
      });
    } catch (error) {
      console.error("Error in clearwarnings command:", error);
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
};
