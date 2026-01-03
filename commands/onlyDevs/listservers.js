import {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import config from '../../config.js';

const IDLE_TIMEOUT = 30; // in seconds
const MAX_PER_PAGE = 8; // reduced to make space for additional info

export default {
  name: "listservers",
  devOnly: true,
  category: "ONLYDEVS",
  description: "Lists all/matching servers with member counts",
  usage: "listservers [match]",
  aliases: ["listserver", "findserver", "findservers", "ls"],
  async execute(client, message, args) {
    // Check if user is authorized
    if (!config.devs.includes(message.author.id)) {
      return message.reply('You do not have permission to use this command.');
    }

    const matched = [];
    const match = args.join(" ") || null;
    if (match) {
      // match by id
      if (client.guilds.cache.has(match)) {
        matched.push(client.guilds.cache.get(match));
      }

      // match by name
      client.guilds.cache
        .filter((g) => g.name.toLowerCase().includes(match.toLowerCase()))
        .forEach((g) => matched.push(g));
    }

    // Sort servers by member count (descending)
    const servers = (match ? matched : Array.from(client.guilds.cache.values()))
      .sort((a, b) => b.memberCount - a.memberCount);

    const total = servers.length;
    const maxPerPage = MAX_PER_PAGE;
    const totalPages = Math.ceil(total / maxPerPage);

    if (totalPages === 0) return message.reply("No servers found");
    let currentPage = 1;

    // Buttons Row
    let components = [
      new ButtonBuilder()
        .setCustomId("prevBtn")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("nxtBtn")
        .setEmoji("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages === 1),
      new ButtonBuilder()
        .setCustomId("refreshBtn")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Success)
    ];
    let buttonsRow = new ActionRowBuilder().addComponents(components);

    // Embed Builder
    const buildEmbed = () => {
      const start = (currentPage - 1) * maxPerPage;
      const end = start + maxPerPage < total ? start + maxPerPage : total;

      const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.BOT_EMBED)
        .setAuthor({
          name: `Server List ${match ? `(Filtered by: ${match})` : ''}`,
          iconURL: client.user.displayAvatarURL()
        })
        .setDescription(`Showing **${total}** servers sorted by member count`)
        .setFooter({
          text: `Page ${currentPage} of ${totalPages} • ${client.user.username}`,
          iconURL: client.user.displayAvatarURL()
        });

      const fields = [];
      for (let i = start; i < end; i++) {
        const server = servers[i];
        const owner = client.users.cache.get(server.ownerId) || { tag: "Unknown" };

        fields.push({
          name: `#${i + 1} ${server.name}`,
          value: [
            `${config.dot_emoji} ${server.id}`,
            `${config.dot_emoji} Owner: ${owner.tag}`,
            `${config.dot_emoji} Members: ${server.memberCount.toLocaleString()}`,
            `${config.dot_emoji} Created: <t:${Math.floor(server.createdTimestamp / 1000)}:R>`,
            `${config.dot_emoji} Boost Level: ${server.premiumTier} (${server.premiumSubscriptionCount} boosts)`
          ].join("\n"),
          inline: false
        });
      }
      embed.addFields(fields);

      // Update buttons
      let components = [
        ButtonBuilder.from(buttonsRow.components[0]).setDisabled(currentPage === 1),
        ButtonBuilder.from(buttonsRow.components[1]).setDisabled(currentPage === totalPages),
        ButtonBuilder.from(buttonsRow.components[2])
      ];
      buttonsRow = new ActionRowBuilder().addComponents(components);
      return embed;
    };

    // Send Message
    const embed = buildEmbed();
    const sentMsg = await message.reply({ embeds: [embed], components: [buttonsRow] });

    // Listeners
    const collector = sentMsg.createMessageComponentCollector({
      filter: (reaction) => reaction.user.id === message.author.id,
      idle: IDLE_TIMEOUT * 1000,
      dispose: true,
      componentType: ComponentType.Button,
    });

    collector.on("collect", async (response) => {
      if (!["prevBtn", "nxtBtn", "refreshBtn"].includes(response.customId)) return;
      await response.deferUpdate();

      switch (response.customId) {
        case "prevBtn":
          if (currentPage > 1) currentPage--;
          break;
        case "nxtBtn":
          if (currentPage < totalPages) currentPage++;
          break;
        case "refreshBtn":
          // Re-fetch server data
          await client.guilds.fetch();
          break;
      }

      const embed = buildEmbed();
      await sentMsg.edit({ embeds: [embed], components: [buttonsRow] });
    });

    collector.on("end", async () => {
      // Disable all buttons when collector ends
      const disabledComponents = buttonsRow.components.map(button =>
        ButtonBuilder.from(button).setDisabled(true)
      );
      const disabledRow = new ActionRowBuilder().addComponents(disabledComponents);

      try {
        await sentMsg.edit({ components: [disabledRow] });
      } catch (error) {
        // Message might have been deleted
        console.log("Could not edit message components:", error.message);
      }
    });
  },
};
