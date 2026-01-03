import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import {
  getMember,
  removeWarningByIndex,
  getWarningLogs,
} from "../../database/models/Member.js";
import { logModerationAction } from "../../utils/modLogger.js";
import config from "../../config.js";

export default {
  name: "removewarn",
  description: "Remove a specific warning from a user",
  category: "MOD",
  botperms: ["ViewChannel", "SendMessages", "EmbedLinks"],
  userperms: ["ModerateMembers"],
  cooldown: 3,
  aliases: ["delwarn"],
  is_premium: false,
  usage: "removewarn <user> <warning_number>",

  async execute(client, message, args) {
    try {
      // Check if user and warning number are provided
      if (!args[0] || !args[1]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a user and warning number to remove.\n\n**Usage:** \`.removewarn <user> <warning_number>\`.`
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

      // Parse warning number
      const warningNumber = parseInt(args[1]);
      if (isNaN(warningNumber) || warningNumber < 1) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Invalid warning number. Please provide a valid positive number.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get member data and warnings
      const memberData = await getMember(message.guild.id, targetMember.id);
      const warningHistory = await getWarningLogs(
        message.guild.id,
        targetMember.id
      );

      // Check if user has any warnings
      if (warningHistory.length === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | **${targetMember.user.username}** has no warnings to remove.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if warning number exists
      if (warningNumber > warningHistory.length) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Warning number **${warningNumber}** does not exist. **${targetMember.user.username}** only has **${warningHistory.length}** warning(s).`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get the specific warning
      const warningToRemove = warningHistory[warningNumber - 1];

      // Create confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `Are you sure you want to remove warning **#${warningNumber}** from **${targetMember.user.username}**?`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId(`removewarn_confirm_${message.author.id}_${Date.now()}`)
        .setLabel("Confirm Removal")
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`removewarn_cancel_${message.author.id}_${Date.now()}`)
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
          if (interaction.customId.includes("removewarn_cancel_")) {
            const cancelledEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.ERROR)
              .setDescription(
                `${config.cross_emoji} | Warning removal cancelled.`
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

          if (interaction.customId.includes("removewarn_confirm_")) {
            // Show loading state
            const loadingButton = new ButtonBuilder()
              .setCustomId(`removewarn_loading_${Date.now()}`)
              .setLabel("Removing...")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true);

            const loadingRow = new ActionRowBuilder().addComponents(
              loadingButton
            );

            await interaction.update({ components: [loadingRow] });

            try {
              // Remove the warning
              const updatedMember = await removeWarningByIndex(
                message.guild.id,
                targetMember.id,
                warningNumber,
                {
                  id: interaction.user.id,
                  username: interaction.user.username,
                }
              );

              // Log the action
              await logModerationAction(
                client,
                message.guild,
                "removewarn",
                targetMember.user,
                interaction.user,
                `Removed warning #${warningNumber}: ${warningToRemove.reason}`,
                null,
                {
                  warningNumber: warningNumber,
                  originalReason: warningToRemove.reason,
                  remainingWarnings: updatedMember.warnings,
                }
              );

              // Success embed
              const successEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.SUCCESS)
                .setDescription(
                  `${config.check_emoji} | Successfully removed warning **#${warningNumber}** from **${targetMember.user.username}**. Now User Has ${updatedMember.warnings} Warning(s).`
                )
                .setFooter({
                  text: `Removed by ${interaction.user.username}`,
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
                    `One of your warnings has been removed in **${message.guild.name} by ${interaction.user.username}**`
                  )
                  .setFooter({
                    text: `Warning removed from ${message.guild.name}`,
                    iconURL: message.guild.iconURL(),
                  });

                await targetMember.send({ embeds: [dmEmbed] });
              } catch (error) {
                // User has DMs disabled or blocked the bot - this is fine
              }
            } catch (error) {
              console.error("Error removing warning:", error);

              let errorMessage =
                "An error occurred while removing the warning.";
              if (error.message === "Invalid warning index") {
                errorMessage = "Invalid warning number.";
              } else if (error.message === "Warning already removed") {
                errorMessage = "This warning has already been removed.";
              }

              const errorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setDescription(`${config.cross_emoji} | ${errorMessage}`)
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
                `${config.cross_emoji} | Warning removal timed out. Please try again.`
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
      console.error("Error in removewarn command:", error);
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
