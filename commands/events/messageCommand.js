import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { applyCooldown } from "../../utils/cooldown.js";
import { getUser } from "../../database/models/User.js";
import { isUserBlocked } from "../../database/models/ClientConfig.js";
import { getSettings } from "../../database/models/Guild.js";
import config from "../../config.js";
export default {
  name: "messageCommand",
  isEvent: true,
  type: "messageCreate",
  async execute(client, message) {
    if (
      message.author.bot ||
      !message.guild ||
      message.system ||
      message.webhookId
    )
      return;

    // Check if user is blocked from using the bot
    try {
      const userBlocked = await isUserBlocked(message.author.id);
      if (userBlocked) {
        // Only respond if user is trying to use a command (has prefix or mentions bot)
        const data = await getSettings(message.guild.id);
        const prefix = data?.prefix || config.prefix || '!';
        const mentionedBot =
          message.content.startsWith(`<@${client.user.id}>`) ||
          message.content.startsWith(`<@!${client.user.id}>`);
        const hasPrefix = message.content.startsWith(prefix);

        if (hasPrefix || mentionedBot) {
          const blockEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS?.ERROR || 0xff0000)
            .setDescription(
              `You are **blocked** from using **${client.user.username}** commands.\n\nIf you believe this is a mistake, please contact the bot developers.`
            )
            .setFooter({
              text: "Global Bot Block System",
              iconURL: client.user.displayAvatarURL(),
            });

          try {
            await message.reply({ embeds: [blockEmbed] });
          } catch (replyError) {
            try {
              await message.reply(
                "You are blocked from using this bot's commands."
              );
            } catch (simpleReplyError) { }
          }
        }
        return;
      }
    } catch (error) {
      console.error("Error checking user block status:", error);
    }

    const data = await getSettings(message.guild.id);
    const prefix = data?.prefix || config.prefix || '!';

    // Check for no-prefix users
    let hasNoPrefix = false;
    try {
      const userData = await getUser(message.author.id);
      if (userData?.noPrefix) {
        hasNoPrefix = true;
      }
    } catch (error) {
      console.error("Error checking user no-prefix status:", error);
    }

    if (message.content === `<@${client.user.id}>`) {
      const cooldownTime = applyCooldown(message.author.id, "botmention", 3);
      if (cooldownTime) {
        return message.reply(`Please wait ${Math.ceil(cooldownTime / 1000)} seconds before using this again.`);
      }
      //cooldown checking ended

      let embed = new EmbedBuilder()
        .setColor("#0d95fe")
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })

        .setDescription(
          `Hey <@${message.author.id}>! **[${client.user.username}](https://discord.com/oauth2/authorize?client_id=1364516570964955186)**, Is A Powerful Discord Bot Developed by Team EliteQ, designed for esports organizations and gaming communities. It provides smooth management of Esports scrims and tournaments along with advanced moderation tools and utilities, giving your server complete control, and professional esports hosting support..\n\n<a:arrow:1379027587967221830> **Prefix for this server is :** \`${data.prefix}\`\n<a:arrow:1379027587967221830> **Type** \`${data.prefix}help\` **for more information.**\n<a:arrow:1379027587967221830> **This Server Total Members Are! :** \`${message.guild?.memberCount || "N/A"}\``
        )
        .setThumbnail(client.user.displayAvatarURL())

        .setFooter({
          text: "Powered by Team EliteQ",
          iconURL:
            "https://cdn.discordapp.com/attachments/1116257414711345152/1399382694386995274/NewProject6Copy29FE110-ezgif.com-video-to-gif-converter.gif",
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Invite Me")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=8`),
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/J8gXBSt3e5"),
        new ButtonBuilder()
          .setLabel("Developer")
          .setStyle(ButtonStyle.Link)
          .setURL("https://eliteq.xyz/dev"),
        new ButtonBuilder()
          .setLabel("Website")
          .setStyle(ButtonStyle.Link)
          .setURL("https://eliteq.xyz/selector")
      );

      try {
        await message.channel.send({ embeds: [embed], components: [row] });
      } catch (e) {
        try {
          await message.author.send({
            content: `Error while sending message there : ${e.message}`,
          });
        } catch (dmError) { }
      }
    }
    // Check if message starts with the prefix or if user has no-prefix access
    const startsWithPrefix = message.content.startsWith(data.prefix);

    if (!startsWithPrefix && !hasNoPrefix) return;

    // Get the content without prefix (or the full content if no-prefix user)
    const contentWithoutPrefix = startsWithPrefix
      ? message.content.slice(data.prefix.length).trim()
      : message.content.trim();

    // Try to find a command that matches, checking for multi-word commands first
    let command = null;
    let cmd = null;
    let args = [];

    // Get all command names and aliases, sort by length (longest first) to match multi-word commands first
    const allCommands = [];
    for (const [name, cmdObj] of client.commands) {
      allCommands.push({ name: name.toLowerCase(), command: cmdObj });
      if (cmdObj.aliases) {
        for (const alias of cmdObj.aliases) {
          allCommands.push({ name: alias.toLowerCase(), command: cmdObj });
        }
      }
    }

    // Sort by name length (longest first) to prioritize multi-word commands
    allCommands.sort((a, b) => b.name.length - a.name.length);

    // Find the best matching command
    for (const cmdInfo of allCommands) {
      const cmdName = cmdInfo.name;
      // Check if the content starts with this command name (with space or end of string after)
      if (
        contentWithoutPrefix.toLowerCase().startsWith(cmdName) &&
        (contentWithoutPrefix.length === cmdName.length ||
          contentWithoutPrefix[cmdName.length] === " ")
      ) {
        command = cmdInfo.command;
        cmd = cmdName;
        // Get remaining args after the command name
        const remainingContent = contentWithoutPrefix
          .slice(cmdName.length)
          .trim();
        args = remainingContent ? remainingContent.split(/ +/) : [];
        break;
      }
    }

    if (!command) {
      return;
    }
    let devIds = config.devs;
    if (command.devOnly && !devIds.includes(message.author.id)) {
      return message.reply("You are not authorized to use this command.");
    }
    if (command.devOnly) {
    }
    if (command.isEvent) return;

    // Apply cooldown
    if (command.cooldown) {
      const cooldownTime = applyCooldown(message.author.id, command.name, command.cooldown);
      if (cooldownTime) {
        return message.reply(`Please wait ${Math.ceil(cooldownTime / 1000)} seconds before using **${command.name}** again.`);
      }
    }

    if (command.userperms) {
      const missingUserPerms = command.userperms.filter(
        (perm) => !message.member.permissions.has(perm)
      );
      if (missingUserPerms.length)
        return message.reply(
          `You are missing the following permissions to use this command: ${missingUserPerms.join(", ")}`
        );
    }
    if (command.botperms) {
      const missingBotPerms = command.botperms.filter(
        (perm) => !message.guild.members.me.permissions.has(perm)
      );
      if (missingBotPerms.length)
        return message.reply(
          `I am missing the following permissions to execute this command: ${missingBotPerms.join(", ")}`
        );
    }
    if (command.is_premium) {
      if (!data.isPremium)
        return message.reply(
          `This is a premium command, to use this command your server must be premium. To get premium [Click Here](${config.DASHBOARD?.baseURL || 'https://eliteq.xyz'}/premium)`
        );
    }
    if (command.args && !args.length)
      return message.channel.send(`You didn't provide any arguments.`);
    try {
      client.prefix = prefix;
      await command.execute(client, message, args);
    } catch (error) {
      console.error("Error executing command:", error);
      message.reply(
        error.message || "There was an error trying to execute that command!"
      );
    }
  },
};
