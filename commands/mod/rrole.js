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
  name: "rrole",
  description: "Remove a role from one or multiple users",
  category: "MOD",
  botperms: ["ManageRoles"],
  userperms: ["ManageRoles"],
  cooldown: 3,
  is_premium: false,
  usage: "rrole <role> [user1] [user2] [user3] ...",
  subcommands: ["humans"],

  async execute(client, message, args) {
    try {
      // Check for subcommands
      if (args[0] && args[0].toLowerCase() === "humans") {
        return this.handleHumansSubcommand(client, message, args.slice(1));
      }

      // Check if role is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide a role to remove.\n\n**Usage:** `.rrole <role> [user1] [user2] [user3] ...`\n**Subcommands:** `.rrole humans <role>` - Remove role from all humans"
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Parse role from first argument
      let roleId = args[0].replace(/[<@&>]/g, "");
      let targetRole;

      try {
        targetRole =
          message.guild.roles.cache.get(roleId) ||
          (await message.guild.roles.fetch(roleId));
      } catch (error) {
        // If not a valid ID, try to find by name
        targetRole = message.guild.roles.cache.find(
          (role) => role.name.toLowerCase() === args[0].toLowerCase()
        );
      }

      if (!targetRole) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "The specified role was not found. Please check the role name or mention."
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if bot can manage this role
      if (
        targetRole.position >= message.guild.members.me.roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "I cannot manage this role because it's higher than or equal to my highest role."
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check if user can manage this role
      if (
        targetRole.position >= message.member.roles.highest.position &&
        message.author.id !== message.guild.ownerId
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "You cannot manage this role because it's higher than or equal to your highest role."
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Parse target members
      let targetMembers = [];

      if (args.length > 1) {
        // Extract member mentions/IDs from remaining arguments
        for (let i = 1; i < args.length; i++) {
          const userId = args[i].replace(/[<@!>]/g, "");
          if (/^\d{17,19}$/.test(userId)) {
            try {
              const member =
                message.guild.members.cache.get(userId) ||
                (await message.guild.members.fetch(userId));
              if (member) {
                targetMembers.push(member);
              }
            } catch (error) {
              // Invalid user ID, skip
            }
          }
        }
      }

      // If no members specified, get all members with the role
      if (targetMembers.length === 0) {
        // Fetch all guild members to ensure we have the complete list
        try {
          await message.guild.members.fetch();
        } catch (error) {
          console.log("Could not fetch all members, using cache");
        }

        targetMembers = message.guild.members.cache
          .filter((member) => member.roles.cache.has(targetRole.id))
          .map((member) => member);

        if (targetMembers.length === 0) {
          const errorEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription(`No members currently have the ${targetRole} role.`)
            .setFooter({
              text: `Requested by ${message.author.username}`,
              iconURL: message.author.displayAvatarURL(),
            });

          return message.reply({ embeds: [errorEmbed] });
        }

        // Ask for confirmation to remove from all members
        const confirmEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(
            `No members were specified. Do you want to remove ${targetRole} from **all ${targetMembers.length} member${targetMembers.length !== 1 ? "s" : ""}** who currently have this role?`
          )
          .setFooter({
            text: `If you wish to remove the role from specific users, use: ${config.prefix || "."}rrole @role @user1 @user2 @user3 ...`,
            iconURL: message.author.displayAvatarURL(),
          });

        const yesButton = new ButtonBuilder()
          .setCustomId(`rrole_confirm_yes_${message.author.id}_${Date.now()}`)
          .setLabel("Yes")
          .setStyle(ButtonStyle.Success);

        const noButton = new ButtonBuilder()
          .setCustomId(`rrole_confirm_no_${message.author.id}_${Date.now()}`)
          .setLabel("No")
          .setStyle(ButtonStyle.Danger);

        const confirmRow = new ActionRowBuilder().addComponents(
          yesButton,
          noButton
        );
        const confirmMsg = await message.reply({
          embeds: [confirmEmbed],
          components: [confirmRow],
        });

        const confirmCollector = confirmMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000,
          filter: (i) => i.user.id === message.author.id,
        });

        try {
          const interaction = await new Promise((resolve, reject) => {
            confirmCollector.on("collect", resolve);
            confirmCollector.on("end", (collected) => {
              if (collected.size === 0) reject(new Error("timeout"));
            });
          });

          await interaction.deferUpdate();

          if (interaction.customId.includes("rrole_confirm_no_")) {
            const cancelledEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.ERROR)
              .setTitle(`${config.cross_emoji} Operation Cancelled`)
              .setDescription(
                `Alright, operation cancelled. If you wish to remove the role from specific users, use:\n\n\`${config.prefix || "."}rrole @role @user1 @user2 @user3 ...\``
              )
              .setFooter({
                text: `Requested by ${message.author.username}`,
                iconURL: message.author.displayAvatarURL(),
              });

            return confirmMsg.edit({
              embeds: [cancelledEmbed],
              components: [],
            });
          }

          // Delete the confirmation message when user clicks Yes
          await confirmMsg.delete().catch(() => { });
        } catch (error) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setDescription("Confirmation timed out. Operation cancelled.")
            .setFooter({
              text: `Requested by ${message.author.username}`,
              iconURL: message.author.displayAvatarURL(),
            });

          return confirmMsg.edit({ embeds: [timeoutEmbed], components: [] });
        }
      }

      const reason = `Action done by ${message.author.tag} (ID: ${message.author.id})`;
      const memberCount = targetMembers.length;

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Removing ${targetRole} from ${memberCount} member${memberCount !== 1 ? "s" : ""}.`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

      // Remove role from members
      const successfulMembers = [];
      const failedMembers = [];
      const membersWhoDidntHaveRole = []; // Track who didn't have the role

      for (const member of targetMembers) {
        try {
          if (member.roles.cache.has(targetRole.id)) {
            await member.roles.remove(targetRole, reason);
            successfulMembers.push(member);

            // Log the moderation action for each member who had the role removed
            await logModerationAction(
              client,
              message.guild,
              'rrole',
              member.user,
              message.author,
              reason,
              null,
              { roleName: targetRole.name, roleId: targetRole.id, action: 'removed' }
            );
          } else {
            membersWhoDidntHaveRole.push(member);
          }
        } catch (error) {
          failedMembers.push(member);
        }
      }

      // Create revert button
      const revertButton = new ButtonBuilder()
        .setCustomId(
          `rrole_revert_${targetRole.id}_${message.author.id}_${Date.now()}`
        )
        .setLabel("Give Back")
        .setStyle(ButtonStyle.Secondary);

      const actionRow = new ActionRowBuilder().addComponents(revertButton);

      // Success embed
      const successEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.SUCCESS)
        .setDescription(
          `${config.check_emoji} | Removed ${targetRole} from ${successfulMembers.length} member${successfulMembers.length !== 1 ? "s" : ""}.${membersWhoDidntHaveRole.length > 0 ? ` (${membersWhoDidntHaveRole.length} didn't have the role)` : ""}${failedMembers.length > 0 ? ` (Failed: ${failedMembers.length})\n\n\`\`\`If this role still showing in user profile please restart your discord or force stop it then check user profile again.\`\`\`` : ""}`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const successMsg = await loadingMsg.edit({
        embeds: [successEmbed],
        components: [actionRow],
      });

      // Handle revert button
      const mainCollector = successMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000, // 60 seconds
        // No filter - allow all interactions to be collected
      });

      mainCollector.on("collect", async (interaction) => {
        if (interaction.customId.startsWith("rrole_revert_")) {
          // Check if the user who clicked is the command author
          if (interaction.user.id !== message.author.id) {
            await interaction.reply({
              content: `Only the command author (<@${message.author.id}>) can use this button.`,
              flags: 64,
            });
            return;
          }
          try {
            // Check if interaction is still valid (not expired)
            if (!interaction.isRepliable()) {
              console.log("Interaction is no longer repliable");
              return;
            }

            // Set button to loading state
            const loadingButton = new ButtonBuilder()
              .setCustomId(`rrole_revert_loading_${Date.now()}`)
              .setEmoji("<a:loading:1364098193511677963>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true);

            const loadingRow = new ActionRowBuilder().addComponents(
              loadingButton
            );

            try {
              await interaction.update({ components: [loadingRow] });
            } catch (updateError) {
              console.log("Failed to update interaction, it may have expired");
              return;
            }

            const revertReason = `Role reverted by ${interaction.user.tag} (ID: ${interaction.user.id})`;
            let revertSuccess = 0;
            let revertFailed = 0;

            for (const member of successfulMembers) {
              try {
                if (!member.roles.cache.has(targetRole.id)) {
                  await member.roles.add(targetRole, revertReason);
                  revertSuccess++;
                }
              } catch (error) {
                revertFailed++;
              }
            }

            const revertEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.SUCCESS)
              .setDescription(
                `${config.check_emoji} | Successfully added ${targetRole} back to ${revertSuccess} member${revertSuccess !== 1 ? "s" : ""}.${revertFailed > 0 ? ` (Failed: ${revertFailed})` : ""}`
              )
              .setFooter({
                text: `Reverted by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
              });

            try {
              await interaction.followUp({
                embeds: [revertEmbed],
                flags: 64,
              });
            } catch (followUpError) {
              console.log(
                "Failed to send follow up, interaction may have expired"
              );
            }

            // Disable the button after revert
            revertButton.setDisabled(true);
            try {
              await interaction.editReply({ components: [actionRow] });
            } catch (editError) {
              // Try to edit the original message instead
              try {
                await successMsg.edit({ components: [actionRow] });
              } catch (msgEditError) {
                console.log("Could not disable button after revert");
              }
            }
            mainCollector.stop();
          } catch (error) {
            console.error("Error handling revert interaction:", error);
            // Try to disable the button if possible
            try {
              revertButton.setDisabled(true);
              await successMsg.edit({ components: [actionRow] });
            } catch (editError) {
              console.error("Could not disable button after error:", editError);
            }
          }
        }
      });

      mainCollector.on("end", async () => {
        try {
          // Disable the button after timeout
          revertButton.setDisabled(true);
          await successMsg.edit({ components: [actionRow] });
        } catch (error) {
          // Message might be deleted or interaction expired
          console.error("Could not disable button on timeout:", error);
        }
      });
    } catch (error) {
      console.error("Error in rrole command:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setDescription(
          "An unexpected error occurred while processing the command."
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      return message.reply({ embeds: [errorEmbed] });
    }
  },

  async handleHumansSubcommand(client, message, args) {
    try {
      // Check if role is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide a role to remove from humans.\n\n**Usage:** `.rrole humans <role>`"
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Parse role from first argument
      let roleId = args[0].replace(/[<@&>]/g, "");
      let targetRole;

      try {
        targetRole =
          message.guild.roles.cache.get(roleId) ||
          (await message.guild.roles.fetch(roleId));
      } catch (error) {
        // If not a valid ID, try to find by name
        targetRole = message.guild.roles.cache.find(
          (role) => role.name.toLowerCase() === args[0].toLowerCase()
        );
      }

      if (!targetRole) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "The specified role was not found. Please check the role name or mention."
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Check role hierarchy
      if (
        targetRole.position >= message.guild.members.me.roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "I cannot manage this role because it's higher than or equal to my highest role."
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      if (
        targetRole.position >= message.member.roles.highest.position &&
        message.author.id !== message.guild.ownerId
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "You cannot manage this role because it's higher than or equal to your highest role."
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Get all human members with the role
      // Fetch all guild members to ensure we have the complete list
      try {
        await message.guild.members.fetch();
      } catch (error) {
        console.log("Could not fetch all members, using cache");
      }

      const targetMembers = message.guild.members.cache
        .filter(
          (member) => !member.user.bot && member.roles.cache.has(targetRole.id)
        )
        .map((member) => member);

      if (targetMembers.length === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `No human members currently have the ${targetRole} role.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [errorEmbed] });
      }

      // Ask for confirmation
      const confirmEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `Are You Sure? ${targetRole} will be removed from all **${targetMembers.length} human${targetMembers.length !== 1 ? "s" : ""}** in the server.`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const yesButton = new ButtonBuilder()
        .setCustomId(
          `rrole_humans_confirm_yes_${message.author.id}_${Date.now()}`
        )
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success);

      const noButton = new ButtonBuilder()
        .setCustomId(
          `rrole_humans_confirm_no_${message.author.id}_${Date.now()}`
        )
        .setLabel("No")
        .setStyle(ButtonStyle.Danger);

      const confirmRow = new ActionRowBuilder().addComponents(
        yesButton,
        noButton
      );
      const confirmMsg = await message.reply({
        embeds: [confirmEmbed],
        components: [confirmRow],
      });

      const confirmCollector = confirmMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
        filter: (i) => i.user.id === message.author.id,
      });

      try {
        const interaction = await new Promise((resolve, reject) => {
          confirmCollector.on("collect", resolve);
          confirmCollector.on("end", (collected) => {
            if (collected.size === 0) reject(new Error("timeout"));
          });
        });

        await interaction.deferUpdate();

        if (interaction.customId.includes("rrole_humans_confirm_no_")) {
          const cancelledEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.SUCCESS)
            .setDescription("Alright, operation cancelled.")
            .setFooter({
              text: `Requested by ${message.author.username}`,
              iconURL: message.author.displayAvatarURL(),
            });

          return confirmMsg.edit({ embeds: [cancelledEmbed], components: [] });
        }

        // Delete the confirmation message when user clicks Yes
        await confirmMsg.delete().catch(() => { });
      } catch (error) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription("Confirmation timed out. Operation cancelled.")
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return confirmMsg.edit({ embeds: [timeoutEmbed], components: [] });
      }

      const reason = `Action done by ${message.author.tag} (ID: ${message.author.id})`;

      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `${config.loading_emoji} | Removing ${targetRole} from ${targetMembers.length} human${targetMembers.length !== 1 ? "s" : ""}.`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

      // Remove role from members
      let success = 0;
      let failed = 0;

      for (const member of targetMembers) {
        try {
          await member.roles.remove(targetRole, reason);
          success++;

          // Log the moderation action for each member who had the role removed
          await logModerationAction(
            client,
            message.guild,
            'rrole',
            member.user,
            message.author,
            reason,
            null,
            { roleName: targetRole.name, roleId: targetRole.id, action: 'removed', bulkAction: 'humans' }
          );
        } catch (error) {
          failed++;
        }
      }

      // Create revert button
      const revertButton = new ButtonBuilder()
        .setCustomId(
          `rrole_humans_revert_${targetRole.id}_${message.author.id}_${Date.now()}`
        )
        .setLabel("Give Back")
        .setStyle(ButtonStyle.Secondary);

      const actionRow = new ActionRowBuilder().addComponents(revertButton);

      // Success embed
      const successEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.SUCCESS)
        .setDescription(
          `${config.check_emoji} | Successfully removed ${targetRole} from ${success} human${success !== 1 ? "s" : ""}.${failed > 0 ? ` (Failed: ${failed})` : ""}`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const successMsg = await loadingMsg.edit({
        embeds: [successEmbed],
        components: [actionRow],
      });

      // Handle revert button
      const revertCollector = successMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000, // 60 seconds
        // No filter - allow all interactions to be collected
      });

      revertCollector.on("collect", async (interaction) => {
        if (interaction.customId.startsWith("rrole_humans_revert_")) {
          // Check if the user who clicked is the command author
          if (interaction.user.id !== message.author.id) {
            await interaction.reply({
              content: `Only the command author (<@${message.author.id}>) can use this button.`,
              flags: 64,
            });
            return;
          }
          try {
            // Set button to loading state
            const loadingButton = new ButtonBuilder()
              .setCustomId(`rrole_humans_revert_loading_${Date.now()}`)
              .setEmoji("<a:loading:1364098193511677963>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true);

            const loadingRow = new ActionRowBuilder().addComponents(
              loadingButton
            );
            await interaction.update({ components: [loadingRow] });

            const revertReason = `Role reverted by ${interaction.user.tag} (ID: ${interaction.user.id})`;
            let revertSuccess = 0;
            let revertFailed = 0;

            for (const member of targetMembers) {
              try {
                if (!member.roles.cache.has(targetRole.id)) {
                  await member.roles.add(targetRole, revertReason);
                  revertSuccess++;
                }
              } catch (error) {
                revertFailed++;
              }
            }

            const revertEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.SUCCESS)
              .setDescription(
                `${config.check_emoji} | Successfully added ${targetRole} back to ${revertSuccess} human${revertSuccess !== 1 ? "s" : ""}.${revertFailed > 0 ? ` (Failed: ${revertFailed})` : ""}`
              )
              .setFooter({
                text: `Reverted by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
              });

            await interaction.followUp({
              embeds: [revertEmbed],
              flags: 64,
            });

            // Disable the button after revert
            revertButton.setDisabled(true);
            await interaction.editReply({ components: [actionRow] });
            revertCollector.stop();
          } catch (error) {
            console.error("Error handling humans revert interaction:", error);
            // Try to disable the button if possible
            try {
              revertButton.setDisabled(true);
              await successMsg.edit({ components: [actionRow] });
            } catch (editError) {
              console.error("Could not disable button after error:", editError);
            }
          }
        }
      });

      revertCollector.on("end", async () => {
        try {
          // Disable the button after timeout
          revertButton.setDisabled(true);
          await successMsg.edit({ components: [actionRow] });
        } catch (error) {
          // Message might be deleted or interaction expired
          console.error("Could not disable button on timeout:", error);
        }
      });
    } catch (error) {
      console.error("Error in rrole humans subcommand:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setDescription(
          "An unexpected error occurred while processing the command."
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      return message.reply({ embeds: [errorEmbed] });
    }
  },
};
