import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { inspect } from "util";

export default {
  name: "eval",
  devOnly: true,
  category: "ONLYDEVS",
  description: "Evaluate JavaScript code.",
  async execute(client, message, args) {
    const code = args.join(" ");
    if (!code) return message.reply("Please provide some code to evaluate.");

    try {
      let evaled = await eval(code);
      if (typeof evaled !== "string") {
        evaled = inspect(evaled, { depth: 0 });
      }

      await paginate(message, evaled);
    } catch (err) {
      console.error(err);
      message.reply(`\`ERROR\` \`\`\`xl\n${err}\n\`\`\``);
    }
  },
};

async function paginate(message, text) {
  const chunkSize = 2000; // Discord message character limit
  const pages = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    pages.push(text.substring(i, i + chunkSize));
  }

  if (pages.length === 1) {
    return message.reply(`\`\`\`js\n${pages[0]}\n\`\`\``);
  }

  let currentPage = 0;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("◀️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("▶️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === pages.length - 1)
  );

  const embed = new EmbedBuilder()
    .setTitle("Eval Output")
    .setDescription(`\`\`\`js\n${pages[currentPage]}\n\`\`\``)
    .setFooter({ text: `Page ${currentPage + 1} of ${pages.length}` });

  const reply = await message.reply({ embeds: [embed], components: [row] });

  const filter = (i) => i.user.id === message.author.id;
  const collector = reply.createMessageComponentCollector({
    filter,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "prev") {
      currentPage--;
    } else if (i.customId === "next") {
      currentPage++;
    }

    const newEmbed = new EmbedBuilder()
      .setTitle("Eval Output")
      .setDescription(`\`\`\`js\n${pages[currentPage]}\n\`\`\``)
      .setFooter({ text: `Page ${currentPage + 1} of ${pages.length}` });

    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("▶️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === pages.length - 1)
    );

    await i.update({ embeds: [newEmbed], components: [newRow] });
  });

  collector.on("end", async () => {
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("▶️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    await reply.edit({ components: [disabledRow] });
  });
}
