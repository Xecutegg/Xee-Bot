import { EmbedBuilder } from "discord.js";
import { getMember, getWarningLogs } from "../../database/models/Member.js";
import { buildEmbed } from "../../utils/buildEmbed.js";
import config from "../../config.js";

export default {
  name: "warnings",
  description: "Check warnings for a user",
  category: "MOD",
  botperms: ["ViewChannel", "SendMessages", "EmbedLinks"],
  userperms: ["ModerateMembers"],
  cooldown: 3,
  aliases: ["checkwarnings"],
  is_premium: false,
  usage: "warnings <user>",

  async execute(client, message, args) {
    try {
      // Check if user is provided
      if (!args[0]) {
        const errorEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setDescription(
            `${config.cross_emoji} | Please provide a user to check warnings for.`
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
          .setDescription(
            `${config.cross_emoji} | Bots cannot receive warnings.`
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

      // Create warnings embed
      if (warningHistory.length === 0) {
        const noWarningsEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.SUCCESS)
          .setDescription(
            `**${targetMember.user.username}** has no warnings in this server.`
          )
          .setFooter({
            text: `Requested by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL(),
          });

        return message.reply({ embeds: [noWarningsEmbed] });
      }

      // Create warning list
      const warningList = warningHistory
        .map((warning, index) => {
          const timeStamp = `<t:${Math.floor(warning.timestamp.getTime() / 1000)}:R>`;
          return `**${index + 1}.** ${warning.reason}\n${config.dot_emoji} **By:** ${warning.moderator.username} ${timeStamp}`;
        })
        .join("\n\n");

      const warningsEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setDescription(
          `**Total Active Warnings:** ${memberData.warnings}\n\n${warningList}`
        )
        .setThumbnail(targetMember.user.displayAvatarURL())
        .addFields({
          name: "User Information",
          value: `**User:** ${targetMember.user}\n**ID:** \`${targetMember.id}\`\n**Joined:** <t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`,
          inline: false,
        })
        .setFooter({
          text: `Requested by ${message.author.username} • Page 1 of 1`,
          iconURL: message.author.displayAvatarURL(),
        });

      // If the warning list is too long, split into pages
      if (warningList.length > 2000) {
        const pages = [];
        const warningsPerPage = 5;

        for (let i = 0; i < warningHistory.length; i += warningsPerPage) {
          const pageWarnings = warningHistory.slice(i, i + warningsPerPage);
          const pageWarningList = pageWarnings
            .map((warning, index) => {
              const timeStamp = `<t:${Math.floor(warning.timestamp.getTime() / 1000)}:R>`;
              return `**${i + index + 1}.** ${warning.reason}\n${config.dot_emoji} **By:** ${warning.moderator.username} ${timeStamp}`;
            })
            .join("\n\n");

          const pageEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.WARNING)
            .setDescription(
              `**Total Active Warnings:** ${memberData.warnings}\n\n${pageWarningList}`
            )
            .setThumbnail(targetMember.user.displayAvatarURL())
            .addFields({
              name: "User Information",
              value: `**User:** ${targetMember.user}\n**ID:** \`${targetMember.id}\`\n**Joined:** <t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`,
              inline: false,
            })
            .setFooter({
              text: `Requested by ${message.author.username} • Page ${Math.floor(i / warningsPerPage) + 1} of ${Math.ceil(warningHistory.length / warningsPerPage)}`,
              iconURL: message.author.displayAvatarURL(),
            });

          pages.push(pageEmbed);
        }

        // Use pagination if multiple pages
        if (pages.length > 1) {
          const { buttonPaginater } = await import(
            "../../utils/buttonPaginater.js"
          );
          return buttonPaginater(message, pages, config.EMBED_COLORS.WARNING);
        } else {
          return message.reply({ embeds: pages });
        }
      }

      return message.reply({ embeds: [warningsEmbed] });
    } catch (error) {
      console.error("Error in warnings command:", error);
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
