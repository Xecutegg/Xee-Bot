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
  name: "role",
  description: "Add a role to one or multiple users",
  category: "MOD",
  botperms: ["ManageRoles"],
  userperms: ["ManageRoles"],
  cooldown: 3,
  is_premium: false,
  usage: "role <role> [user1] [user2] [user3] ...",

  async execute(client, message, args) {
    try {
      // Check if role is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            "Please provide a role to add.\n\n**Usage:** `.role <role> [user1] [user2] [user3] ...`"
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

      // If no members specified, ask for confirmation to add to all members
      if (targetMembers.length === 0) {
        const confirmEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.WARNING)
          .setDescription(
            `No members were specified. Do you want to add ${targetRole} to **all members** in the server?`
          )
          .setFooter({
            text: `If you wish to add the role to specific users, use: ${config.prefix || "."}role @role @user1 @user2 @user3 ...`,
            iconURL: message.author.displayAvatarURL(),
          });

        const yesButton = new ButtonBuilder()
          .setCustomId(`role_confirm_yes_${message.author.id}_${Date.now()}`)
          .setLabel("Yes")
          .setStyle(ButtonStyle.Success);

        const noButton = new ButtonBuilder()
          .setCustomId(`role_confirm_no_${message.author.id}_${Date.now()}`)
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

        const collector = confirmMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000,
          filter: (i) => {
            // Only allow the command author to interact
            if (i.user.id !== message.author.id) {
              // Send ephemeral reply to unauthorized users
              i.reply({
                content: `Only the command author (<@${message.author.id}>) can use this button.`,
                flags: 64,
              }).catch(console.error);
              return false;
            }
            return true;
          },
        });

        try {
          const interaction = await new Promise((resolve, reject) => {
            collector.on("collect", resolve);
            collector.on("end", (collected) => {
              if (collected.size === 0) reject(new Error("timeout"));
            });
          });

          await interaction.deferUpdate();

          if (interaction.customId.includes("role_confirm_no_")) {
            const cancelledEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.ERROR)
              .setDescription(
                `Alright, operation cancelled. If you wish to add the role to specific users, use:\n\n\`${config.prefix || "."}role @role @user1 @user2 @user3 ...\``
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

          // Delete the confirmation message and get all members
          await confirmMsg.delete().catch(() => { });

          // Fetch all guild members to ensure we have the complete list
          try {
            await message.guild.members.fetch();
          } catch (error) {
            console.log("Could not fetch all members, using cache");
          }

          targetMembers = message.guild.members.cache
            .filter((member) => !member.user.bot)
            .map((member) => member);
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
          `${config.loading_emoji} | Adding ${targetRole} to ${memberCount} member${memberCount !== 1 ? "s" : ""}.`
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

      // Add role to members
      const successfulMembers = [];
      const failedMembers = [];
      const membersWhoDidntHaveRole = []; // Track who didn't have the role originally
      const membersWhoAlreadyHadRole = []; // Track who already had the role

      for (const member of targetMembers) {
        try {
          if (!member.roles.cache.has(targetRole.id)) {
            await member.roles.add(targetRole, reason);
            successfulMembers.push(member);
            membersWhoDidntHaveRole.push(member); // These are the ones we actually gave the role to

            // Log the moderation action for each member who received the role
            await logModerationAction(
              client,
              message.guild,
              'role',
              member.user,
              message.author,
              reason,
              null,
              { roleName: targetRole.name, roleId: targetRole.id, action: 'added' }
            );
          } else {
            successfulMembers.push(member); // Already has role, count as success
            membersWhoAlreadyHadRole.push(member); // Track who already had it
          }
        } catch (error) {
          failedMembers.push(member);
        }
      }

      // Create revert button
      const revertButton = new ButtonBuilder()
        .setCustomId(
          `role_revert_${targetRole.id}_${message.author.id}_${Date.now()}`
        )
        .setLabel("Take Back")
        .setStyle(ButtonStyle.Secondary);

      const actionRow = new ActionRowBuilder().addComponents(revertButton);

      // Success embed
      const successEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.SUCCESS)
        .setDescription(
          `${config.check_emoji} | Added ${targetRole} to ${membersWhoDidntHaveRole.length} member${membersWhoDidntHaveRole.length !== 1 ? "s" : ""}.${membersWhoAlreadyHadRole.length > 0 ? ` (${membersWhoAlreadyHadRole.length} already had the role)` : ""}${failedMembers.length > 0 ? ` (Failed: ${failedMembers.length})` : ""}\n\n\`\`\`If you cannot see the role in any of the user's profile, just restart your discord app or check audit log.\`\`\``
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
      const collector = successMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000, // 60 seconds
        filter: (i) => {
          // Only allow the command author to interact
          if (i.user.id !== message.author.id) {
            // Send ephemeral reply to unauthorized users
            i.reply({
              content: `Only the command author (<@${message.author.id}>) can use this button.`,
              flags: 64,
            }).catch(console.error);
            return false;
          }
          return true;
        },
      });

      collector.on("collect", async (interaction) => {
        if (interaction.customId.startsWith("role_revert_")) {
          try {
            // Check if interaction is still valid (not expired)
            if (!interaction.isRepliable()) {
              console.log("Interaction is no longer repliable");
              return;
            }

            // Set button to loading state
            const loadingButton = new ButtonBuilder()
              .setCustomId(`role_revert_loading_${Date.now()}`)
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

            // Only remove role from members who didn't have it originally
            for (const member of membersWhoDidntHaveRole) {
              try {
                if (member.roles.cache.has(targetRole.id)) {
                  await member.roles.remove(targetRole, revertReason);
                  revertSuccess++;
                }
              } catch (error) {
                revertFailed++;
              }
            }

            const revertEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.SUCCESS)
              .setDescription(
                `${config.check_emoji} | Successfully removed ${targetRole} from ${revertSuccess} member${revertSuccess !== 1 ? "s" : ""}.${revertFailed > 0 ? ` (Failed: ${revertFailed})` : ""}`
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
            collector.stop();
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

      collector.on("end", async () => {
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
      console.error("Error in role command:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle(`${config.cross_emoji} An Error Occurred`)
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
