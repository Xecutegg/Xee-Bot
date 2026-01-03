import {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { getSettings } from "../../database/models/Guild.js";
import config from "../../config.js";

export default {
  name: "warnconfig",
  description: "Configure warning system settings for your server",
  category: "MOD",
  botperms: ["ViewChannel", "SendMessages", "EmbedLinks"],
  userperms: ["ManageGuild"],
  cooldown: 5,
  aliases: ["warningsettings", "warnsetup"],
  is_premium: false,
  usage: "warnconfig [limit <number>] [action <timeout|kick|ban>]",

  // Helper function to create configuration embed
  createConfigEmbed(guildSettings, author, isUpdate = false) {
    return new EmbedBuilder()
      .setColor(config.EMBED_COLORS.BOT_EMBED)
      .setTitle(`Warning System Configuration`)
      .setURL(config.SUPPORT_SERVER)
      .setDescription("Current warning system settings for this server:")
      .addFields(
        {
          name: "Maximum Warnings",
          value: `\`${guildSettings.max_warn.limit}\` warnings`,
          inline: true,
        },
        {
          name: "Action on Max Warnings",
          value: `\`${guildSettings.max_warn.action}\``,
          inline: true,
        },
        {
          name: "\u200b",
          value: "\u200b",
          inline: true,
        }
      )
      .addFields({
        name: "**More Usefull Commands**",
        value:
          `\`${config.prefix}warn <user> [reason]\` - Warn a user\n` +
          `\`${config.prefix}warnings <user>\` - Check user's warnings\n` +
          `\`${config.prefix}removewarn <user> <number>\` - Remove specific warning`,
        inline: false,
      })
      .setFooter({
        text: isUpdate
          ? `Last updated by ${author.username}`
          : `Requested by ${author.username}`,
        iconURL: author.displayAvatarURL(),
      });
  },

  async execute(client, message, args) {
    try {
      const guildSettings = await getSettings(message.guild);

      // Initialize max_warn if it doesn't exist
      if (!guildSettings.max_warn) {
        guildSettings.max_warn = {
          limit: 3,
          action: "TIMEOUT"
        };
        await guildSettings.save();
      }

      // If no arguments, show current configuration
      if (!args.length) {
        const configEmbed = this.createConfigEmbed(
          guildSettings,
          message.author
        );

        // Create interactive buttons
        const limitButton = new ButtonBuilder()
          .setCustomId(`warnconfig_limit_${message.author.id}_${Date.now()}`)
          .setLabel("Set Limit")
          .setStyle(ButtonStyle.Success);

        const actionButton = new ButtonBuilder()
          .setCustomId(`warnconfig_action_${message.author.id}_${Date.now()}`)
          .setLabel("Set Action")
          .setStyle(ButtonStyle.Primary);

        const actionRow = new ActionRowBuilder().addComponents(
          limitButton,
          actionButton
        );

        const configMsg = await message.reply({
          embeds: [configEmbed],
          components: [actionRow],
        });

        // Handle button interactions
        const collector = configMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 300000, // 5 minutes
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
            if (interaction.customId.includes("warnconfig_limit_")) {
              const limitEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.WARNING)
                .setDescription(
                  `Please reply with the maximum number of warnings a member can receive before action is taken.\n\n**Current Limit:** ${guildSettings.max_warn.limit}\n**Range:** 1-10 warnings.`
                )
                .setFooter({
                  text: "You have 60 seconds to respond",
                  iconURL: interaction.user.displayAvatarURL(),
                });

              await interaction.reply({
                embeds: [limitEmbed],
                flags: 64,
              });

              const filter = (m) => m.author.id === interaction.user.id;
              const messageCollector = message.channel.createMessageCollector({
                filter,
                time: 60000,
                max: 1,
              });

              messageCollector.on("collect", async (msg) => {
                if (msg.content.toLowerCase() === "cancel") {
                  await interaction.followUp({
                    content: "Operation cancelled.",
                    flags: 64,
                  });
                  return;
                }

                const newLimit = parseInt(msg.content);
                if (isNaN(newLimit) || newLimit < 1 || newLimit > 10) {
                  await interaction.followUp({
                    content:
                      "Invalid number! Please provide a number between 1 and 10.",
                    flags: 64,
                  });
                  return;
                }

                guildSettings.max_warn.limit = newLimit;
                await guildSettings.save();

                // Update the original embed with new values
                const updatedConfigEmbed = this.createConfigEmbed(
                  guildSettings,
                  interaction.user,
                  true
                );

                // Update the original config message
                await configMsg.edit({ embeds: [updatedConfigEmbed] });

                const successEmbed = new EmbedBuilder()
                  .setColor(config.EMBED_COLORS.SUCCESS)
                  .setDescription(
                    `${config.check_emoji} | Warning limit updated to **${newLimit}** warnings.`
                  )
                  .setFooter({
                    text: `Updated by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL(),
                  });

                await interaction.followUp({
                  embeds: [successEmbed],
                  flags: 64,
                });
                await msg.delete().catch(() => { });
              });

              messageCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction
                    .followUp({
                      content: "No response received. Operation timed out.",
                      flags: 64,
                    })
                    .catch(() => { });
                }
              });
            } else if (interaction.customId.includes("warnconfig_action_")) {
              const timeoutButton = new ButtonBuilder()
                .setCustomId(`action_timeout_${interaction.user.id}`)
                .setLabel("Timeout (24h)")
                .setStyle(ButtonStyle.Success);

              const kickButton = new ButtonBuilder()
                .setCustomId(`action_kick_${interaction.user.id}`)
                .setLabel("Kick")
                .setStyle(ButtonStyle.Primary);

              const banButton = new ButtonBuilder()
                .setCustomId(`action_ban_${interaction.user.id}`)
                .setLabel("Ban")
                .setStyle(ButtonStyle.Danger);

              const cancelButton = new ButtonBuilder()
                .setCustomId(`action_cancel_${interaction.user.id}`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary);

              const actionRow1 = new ActionRowBuilder().addComponents(
                timeoutButton,
                kickButton,
                banButton
              );
              const actionRow2 = new ActionRowBuilder().addComponents(
                cancelButton
              );

              const actionEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.WARNING)
                .setDescription(
                  `Select the action to take when a member reaches the maximum warnings:\n\n**Current Action:** ${guildSettings.max_warn.action}.`
                )
                .setFooter({
                  text: "Choose an action below",
                  iconURL: interaction.user.displayAvatarURL(),
                });

              const actionReply = await interaction.reply({
                embeds: [actionEmbed],
                components: [actionRow1, actionRow2],
                flags: 64,
                fetchReply: true,
              });

              const actionCollector =
                actionReply.createMessageComponentCollector({
                  componentType: ComponentType.Button,
                  time: 60000,
                  filter: (i) =>
                    i.user.id === interaction.user.id &&
                    i.customId.startsWith("action_"),
                });

              actionCollector.on("collect", async (actionInteraction) => {
                const actionType = actionInteraction.customId.split("_")[1];

                if (actionType === "cancel") {
                  await actionInteraction.update({
                    content: "Operation cancelled.",
                    embeds: [],
                    components: [],
                  });
                  return;
                }

                // Check bot permissions for the selected action
                let permissionError = null;
                switch (actionType.toUpperCase()) {
                  case "TIMEOUT":
                    if (
                      !message.guild.members.me.permissions.has(
                        PermissionFlagsBits.ModerateMembers
                      )
                    ) {
                      permissionError =
                        "I don't have permission to timeout members.";
                    }
                    break;
                  case "KICK":
                    if (
                      !message.guild.members.me.permissions.has(
                        PermissionFlagsBits.KickMembers
                      )
                    ) {
                      permissionError =
                        "I don't have permission to kick members.";
                    }
                    break;
                  case "BAN":
                    if (
                      !message.guild.members.me.permissions.has(
                        PermissionFlagsBits.BanMembers
                      )
                    ) {
                      permissionError =
                        "I don't have permission to ban members.";
                    }
                    break;
                }

                if (permissionError) {
                  await actionInteraction.update({
                    content: `${config.cross_emoji} | ${permissionError}`,
                    embeds: [],
                    components: [],
                  });
                  return;
                }

                guildSettings.max_warn.action = actionType.toUpperCase();
                await guildSettings.save();

                // Update the original embed with new values
                const updatedConfigEmbed = this.createConfigEmbed(
                  guildSettings,
                  actionInteraction.user,
                  true
                );

                // Update the original config message
                await configMsg.edit({ embeds: [updatedConfigEmbed] });

                const successEmbed = new EmbedBuilder()
                  .setColor(config.EMBED_COLORS.SUCCESS)
                  .setDescription(
                    `${config.check_emoji} | Warning action updated to **${actionType.toUpperCase()}**.`
                  )
                  .setFooter({
                    text: `Updated by ${actionInteraction.user.username}`,
                    iconURL: actionInteraction.user.displayAvatarURL(),
                  });

                await actionInteraction.update({
                  embeds: [successEmbed],
                  components: [],
                });
              });

              actionCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction
                    .editReply({
                      content: "No response received. Operation timed out.",
                      embeds: [],
                      components: [],
                    })
                    .catch(() => { });
                }
              });
            }
          } catch (error) {
            console.error("Error handling button interaction:", error);
            await interaction
              .reply({
                content: "An error occurred while processing your request.",
                flags: 64,
              })
              .catch(() => { });
          }
        });

        collector.on("end", async () => {
          try {
            limitButton.setDisabled(true);
            actionButton.setDisabled(true);
            await configMsg.edit({ components: [actionRow] });
          } catch (error) {
            // Message might be deleted
          }
        });

        return;
      }

      // Handle command line arguments
      const subcommand = args[0].toLowerCase();
      const value = args[1];

      if (subcommand === "limit") {
        if (!value) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | Please provide a warning limit.\n\n**Usage:** \`.warnconfig limit <number>\``
            );
          return message.reply({ embeds: [errorEmbed] });
        }

        const newLimit = parseInt(value);
        if (isNaN(newLimit) || newLimit < 1 || newLimit > 10) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | Invalid warning limit. Please provide a number between 1 and 10.`
            );
          return message.reply({ embeds: [errorEmbed] });
        }

        guildSettings.max_warn.limit = newLimit;
        await guildSettings.save();

        // Show updated configuration
        const updatedConfigEmbed = this.createConfigEmbed(
          guildSettings,
          message.author,
          true
        );

        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | Warning limit updated to **${newLimit}** warnings.`
          )
          .setFooter({
            text: `Updated by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({
          embeds: [successEmbed, updatedConfigEmbed],
        });
      } else if (subcommand === "action") {
        if (!value) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | Please provide an action.`
            );
          return message.reply({ embeds: [errorEmbed] });
        }

        const action = value.toUpperCase();
        if (!["TIMEOUT", "KICK", "BAN"].includes(action)) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(
              `${config.cross_emoji} | Invalid action. Available actions: \`timeout\`, \`kick\`, \`ban\``
            );
          return message.reply({ embeds: [errorEmbed] });
        }

        // Check bot permissions
        let permissionError = null;
        switch (action) {
          case "TIMEOUT":
            if (
              !message.guild.members.me.permissions.has(
                PermissionFlagsBits.ModerateMembers
              )
            ) {
              permissionError = "I don't have permission to timeout members.";
            }
            break;
          case "KICK":
            if (
              !message.guild.members.me.permissions.has(
                PermissionFlagsBits.KickMembers
              )
            ) {
              permissionError = "I don't have permission to kick members.";
            }
            break;
          case "BAN":
            if (
              !message.guild.members.me.permissions.has(
                PermissionFlagsBits.BanMembers
              )
            ) {
              permissionError = "I don't have permission to ban members.";
            }
            break;
        }

        if (permissionError) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(`${config.cross_emoji} | ${permissionError}`);
          return message.reply({ embeds: [errorEmbed] });
        }

        guildSettings.max_warn.action = action;
        await guildSettings.save();

        // Show updated configuration
        const updatedConfigEmbed = this.createConfigEmbed(
          guildSettings,
          message.author,
          true
        );

        const successEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `${config.check_emoji} | Warning action updated to **${action}**.`
          )
          .setFooter({
            text: `Updated by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({
          embeds: [successEmbed, updatedConfigEmbed],
        });
      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Invalid subcommand.\n\n**Available Commands:**\n\`${config.prefix}warnconfig\` - Show current configuration\n\`${config.prefix}warnconfig limit <number>\` - Set warning limit`
          );
        return message.reply({ embeds: [errorEmbed] });
      }
    } catch (error) {
      console.error("Error in warnconfig command:", error);
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
