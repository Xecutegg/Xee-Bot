import {
  Colors,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
import {
  Categories,
  getCategoryInfo,
  getAllCategories,
} from "../../structures/Categories.js";
import config from "../../config.js";

const IDLE_TIMEOUT = 300; // 5 minutes

export default {
  name: "help",
  description: "Advanced help menu with category management",
  aliases: ["h"],
  category: "UTILS",
  usage: "help [command/category]",
  botPermissions: ["EmbedLinks"],
  async execute(client, message, args) {
    try {
      const { getSettings } = await import('../../database/models/Guild.js');
      const guild_data = await getSettings(message.guild.id);
      const prefix = guild_data?.prefix || config.prefix || '!';

      // Loading embed
      const loadingEmbed = new EmbedBuilder()
        .setDescription(`${config.loading_emoji || '⏳'} **Loading Help Commands...**`)
        .setColor(config.embed_color || '#0099ff');

      const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

      // Brief loading delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!args[0]) {
        const response = await getHelpMenu({
          client,
          guild: message.guild,
          user: message.author,
          prefix,
        });
        await loadingMsg.edit(response);
        return await createHelpView(loadingMsg, message.author.id, prefix);
      }

      // Handle specific command or category
      const cmd =
        client.commands.get(args[0].toLowerCase()) ||
        client.commands.find((cmd) =>
          cmd.aliases?.includes(args[0].toLowerCase())
        );

      if (cmd && !cmd.isEvent && !cmd.type && !cmd.devOnly) {
        const embed = getCommandUsage(cmd, prefix, args[0]);
        await loadingMsg.edit({ embeds: [embed] });
        return;
      }

      // Check if it's a category
      const categoryUpper = args[0].toUpperCase();
      const categoryCommands = client.commands.filter(
        (cmd) =>
          cmd.category?.toUpperCase() === categoryUpper &&
          !cmd.isEvent &&
          !cmd.type &&
          !cmd.devOnly
      );

      if (categoryCommands.size > 0) {
        const embed = getCategoryHelp(
          categoryUpper,
          categoryCommands,
          prefix,
          message.author
        );
        await loadingMsg.edit({ embeds: [embed] });
        return;
      }

      // Command not found with suggestions
      const allCommands = Array.from(client.commands.keys());
      const suggestions = getClosestMatches(args[0], allCommands);

      const notFoundEmbed = new EmbedBuilder()
        .setDescription(`Command not found with the name \`${args[0]}\`.`)
        .setColor(Colors.Red)
        .setAuthor({
          name: "Command Not Found",
          iconURL: client.user.displayAvatarURL(),
        })
        .setFooter({
          text: `Requested By ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      if (suggestions.length > 0) {
        const matchList = suggestions
          .map((match, index) => `${index + 1}. \`${match}\``)
          .join("\n");
        notFoundEmbed.addFields({
          name: "Did you mean:",
          value: matchList,
          inline: true,
        });
      }

      await loadingMsg.edit({ embeds: [notFoundEmbed] });
    } catch (error) {
      console.error("Help command error:", error);
      await message
        .reply("An error occurred while processing the help command.")
        .catch(() => { });
    }
  },
};

async function getHelpMenu({ client, guild, user, prefix = "!" }) {
  try {
    // Count commands safely
    const prefixCommands = client.commands?.size || 0;
    const totalCommands = prefixCommands;

    // Build features list with emojis and badges
    const featuresList = [
      `${config.esports_emoji} | Esports Commands ${config.new_emoji}`,
      `${config.mod_emoji} | Moderation Commands`,
      `${config.utlis_emoji} | Utility Commands`,
      `${config.info_emoji} | Information Commands`,
      `${config.verify_emoji} | Screenshot Verification`,
      `${config.premium_emoji} | Premium Commands & Features`,
    ];

    const embed = new EmbedBuilder()
      .setColor(config.embed_color || '#0099ff')
      .setTitle(`${client.user.username} Help Center`)
      .setURL(`${config.SUPPORT_SERVER || 'https://discord.gg/support'}`)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields({
        name: "__**Basic Information:**__",
        value: [
          `**Server Prefix:** \`${prefix}\``,
          `**Total Commands:** \`${totalCommands}\``,
          `**[Invite ${client.user.username}](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=2113268958&scope=bot)** | **[Support Server](${config.SUPPORT_SERVER || 'https://discord.gg/support'})**`,
          "",
          "❓ **How to use me?**",
          "```",
          `${prefix}help <command/category>`,
          `For example: ${prefix}help scrims`,
          "```",
        ].join("\n"),
        inline: false,
      })
      .addFields({
        name: "__**Features & Commands**__",
        value: featuresList.join("\n"),
        inline: false,
      })
      .addFields({
        name: "__**Navigation Help**__",
        value: [
          `${config.dot_emoji} For support, Join Our **[Support Server](https://discord.gg/J8gXBSt3e5)**`,
        ].join("\n"),
        inline: false,
      })
      .setFooter({
        text: `Requested By ${user.username}`,
        iconURL: user.displayAvatarURL(),
      });

    // Generate dropdown options safely
    const options = [
      {
        label: "Home",
        value: "HOME",
        description: "Main help menu",
      },
    ];

    // Add categories that are enabled and not hidden
    if (Categories && typeof Categories === "object") {
      for (const [key, category] of Object.entries(Categories)) {
        if (category.enabled === false || category.hideInHelp === true)
          continue;

        options.push({
          label: category.name || key,
          value: key,
          description: `${category.name || key} commands`,
          emoji: category.emoji || "📋",
        });
      }
    }

    const dropdown = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("help-menu")
        .setPlaceholder("Choose a Category for Help")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options)
    );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("homeBtn")
        .setEmoji("<:MekoHome:1379102008623104080>")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("backBtn")
        .setEmoji("<:left:1412094230998028471>")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("quitBtn")
        .setEmoji("<:disable:1379321477769203724>")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("nextBtn")
        .setEmoji("<:right:1412094177457737729>")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false),
      new ButtonBuilder()
        .setCustomId("lastBtn")
        .setLabel("Last")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false)
    );

    return {
      embeds: [embed],
      components: [dropdown, buttons],
    };
  } catch (error) {
    console.error("getHelpMenu error:", error);
    const errorEmbed = new EmbedBuilder()
      .setDescription("❌ Error loading help menu")
      .setColor(Colors.Red);
    return { embeds: [errorEmbed], components: [] };
  }
}

async function createHelpView(message, userId, prefix) {
  try {
    if (!message || !message.channel || !message.editable) {
      console.log("Message is not valid for collector creation");
      return;
    }

    const collector = message.channel.createMessageComponentCollector({
      filter: (interaction) => interaction.user.id === userId,
      time: IDLE_TIMEOUT * 1000,
    });

    let currentIndex = 0;
    let embeds = [];
    let options = [];
    let totalPages = 0;

    // Generate embeds safely
    async function generateEmbeds() {
      try {
        embeds = [];
        options = [];

        // Home option
        options.push({
          label: "🏠 Home",
          value: "HOME",
          description: "Main help menu",
          emoji: "🏠",
        });

        // Add home embed
        const user = await message.client.users.fetch(userId).catch(() => ({
          username: "User",
          displayAvatarURL: () => message.client.user.displayAvatarURL(),
        }));

        const homeResponse = await getHelpMenu({
          client: message.client,
          guild: message.guild,
          user: user,
          prefix,
        });
        embeds.push(homeResponse.embeds[0]);
        totalPages++;

        // Add category embeds safely
        if (Categories && typeof Categories === "object") {
          for (const [key, category] of Object.entries(Categories)) {
            if (category.enabled === false || category.hideInHelp === true)
              continue;

            // Get commands for this category
            const categoryCommands = message.client.commands
              ? Array.from(message.client.commands.values()).filter(
                (cmd) =>
                  cmd.category?.toUpperCase() === key &&
                  !cmd.isEvent &&
                  !cmd.type &&
                  !cmd.devOnly
              )
              : [];

            // Skip if no commands found
            if (categoryCommands.length === 0) continue;

            options.push({
              label: category.name || key,
              value: key,
              description: `${category.name || key} commands`,
              emoji: category.emoji || "📋",
            });

            const categoryEmbed = new EmbedBuilder()
              .setTitle(`${category.emoji || "📋"} __${category.name || key}__`)
              .setThumbnail(message.client.user.displayAvatarURL())
              .setColor(config.embed_color || '#0099ff');

            // Add commands as fields with comma-separated format
            if (categoryCommands.length > 0) {
              // Separate prefix commands and slash commands
              const prefixCommands = categoryCommands.filter(
                (cmd) => !cmd.isSlash
              );
              const slashCommands = categoryCommands.filter(
                (cmd) => cmd.isSlash
              );

              // Add prefix commands field
              if (prefixCommands.length > 0) {
                const prefixCommandList = prefixCommands
                  .map((cmd) => cmd.name)
                  .join(", ");
                categoryEmbed.addFields({
                  name: "__**Prefix Commands**__",
                  value: `\`${prefixCommandList}\``,
                  inline: false,
                });
              }

              // Add slash commands field
              if (slashCommands.length > 0) {
                const slashCommandList = slashCommands
                  .map((cmd) => cmd.name)
                  .join(", ");
                categoryEmbed.addFields({
                  name: "__**Slash Commands**__",
                  value: `\`${slashCommandList}\``,
                  inline: false,
                });
              } else {
                categoryEmbed.addFields({
                  name: "__**Slash Commands**__",
                  value: "`This category has no slash commands`",
                  inline: false,
                });
              }

              // Add aliases field
              const allAliases = [];
              categoryCommands.forEach((cmd) => {
                if (cmd.aliases && cmd.aliases.length > 0) {
                  allAliases.push(...cmd.aliases);
                }
              });

              if (allAliases.length > 0) {
                const aliasesList = allAliases.join(", ");
                categoryEmbed.addFields({
                  name: "__**Aliases**__",
                  value: `\`${aliasesList}\``,
                  inline: false,
                });
              } else {
                categoryEmbed.addFields({
                  name: "__**Aliases**__",
                  value: "`This category has no aliases`",
                  inline: false,
                });
              }
            }

            categoryEmbed.setFooter({
              text: `${categoryCommands.length} command${categoryCommands.length !== 1 ? "s" : ""} in this category`,
              iconURL: user.displayAvatarURL(),
            });

            embeds.push(categoryEmbed);
            totalPages++;
          }
        }

        // Update home embed footer
        if (embeds[0]) {
          embeds[0].setFooter({
            text: `Help page 1/${totalPages} | Requested by: ${user.username}`,
            iconURL: message.client.user.displayAvatarURL(),
          });
        }
      } catch (error) {
        console.error("generateEmbeds error:", error);
      }
    }

    // Initialize
    await generateEmbeds();

    async function updateButtons() {
      const isFirst = currentIndex === 0;
      const isLast = currentIndex === embeds.length - 1;

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("homeBtn")
          .setEmoji("<:MekoHome:1379102008623104080>")
          .setStyle(isFirst ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(isFirst),
        new ButtonBuilder()
          .setCustomId("backBtn")
          .setEmoji("<:left:1412094230998028471>")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isFirst),
        new ButtonBuilder()
          .setCustomId("quitBtn")
          .setEmoji("<:disable:1379321477769203724>")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("nextBtn")
          .setEmoji("<:right:1412094177457737729>")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isLast),
        new ButtonBuilder()
          .setCustomId("lastBtn")
          .setLabel("Last")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isLast)
      );

      return buttons;
    }

    collector.on("collect", async (interaction) => {
      try {
        if (interaction.user.id !== userId) {
          return interaction.reply({
            content:
              "❌ This help menu can only be used by the person who initiated the command.",
            flags: 64,
          });
        }

        if (interaction.replied || interaction.deferred) {
          console.log("Interaction already handled, skipping...");
          return;
        }

        try {
          await interaction.deferUpdate();
        } catch (error) {
          console.log("Failed to defer interaction:", error.message);
          return;
        }

        switch (interaction.customId) {
          case "help-menu":
            const selectedValue = interaction.values[0];
            if (selectedValue === "HOME") {
              currentIndex = 0;
            } else {
              const index = options.findIndex(
                (opt) => opt.value === selectedValue
              );
              if (index !== -1) currentIndex = index;
            }
            break;

          case "homeBtn":
            currentIndex = 0;
            break;

          case "backBtn":
            if (currentIndex > 0) currentIndex--;
            break;

          case "nextBtn":
            if (currentIndex < embeds.length - 1) currentIndex++;
            break;

          case "lastBtn":
            currentIndex = embeds.length - 1;
            break;

          case "quitBtn":
            const closedEmbed = new EmbedBuilder()
              .setDescription("❌ **Help menu closed.**")
              .setColor(Colors.Red);

            try {
              await message.edit({
                embeds: [closedEmbed],
                components: [],
              });
            } catch (editError) {
              console.log("Failed to edit message on quit:", editError.message);
            }
            collector.stop();
            return;
        }

        // Update embed
        const currentEmbed = embeds[currentIndex];
        if (currentEmbed && message && message.editable) {
          const user = interaction.user;
          currentEmbed.setFooter({
            text: `Help page ${currentIndex + 1}/${totalPages} | Requested by: ${user.username}`,
            iconURL: message.client.user.displayAvatarURL(),
          });

          const dropdown = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("help-menu")
              .setPlaceholder("Choose a Category for Help")
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(options)
          );

          try {
            await message.edit({
              embeds: [currentEmbed],
              components: [dropdown, await updateButtons()],
            });
          } catch (editError) {
            console.log("Failed to edit help message:", editError.message);
          }
        }
      } catch (error) {
        console.error("Collector error:", error);
      }
    });

    collector.on("end", (collected, reason) => {
      try {
        if (message && message.editable && reason === "time") {
          const timeoutEmbed = new EmbedBuilder()
            .setDescription(
              "⏰ **Help menu timed out. Use the command again to get help.**"
            )
            .setColor(Colors.Orange);

          message
            .edit({
              embeds: [timeoutEmbed],
              components: [],
            })
            .catch((error) => {
              console.log("Failed to edit message on timeout:", error.message);
            });
        }
      } catch (error) {
        console.log("Collector end error:", error.message);
      }
    });
  } catch (error) {
    console.error("createHelpView error:", error);
  }
}

// Helper functions
function getCommandUsage(cmd, prefix, trigger) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `Command: ${cmd.name}`,
      iconURL: cmd.client?.user?.displayAvatarURL() || null,
    })
    .setColor(Colors.Blue)
    .setDescription(cmd.description || "No description available")
    .addFields([
      {
        name: "📝 Usage",
        value: `\`${prefix}${cmd.usage || cmd.name}\``,
        inline: true,
      },
      {
        name: "📂 Category",
        value: `${getCategoryInfo(cmd.category)?.emoji || '📁'} ${getCategoryInfo(cmd.category)?.name || cmd.category}`,
        inline: true,
      },
    ])

  if (cmd.aliases && cmd.aliases.length > 0) {
    embed.addFields({
      name: "🔄 Aliases",
      value: cmd.aliases.map((alias) => `\`${alias}\``).join(", "),
      inline: false,
    });
  }

  return embed;
}

function getCategoryHelp(categoryKey, commands, prefix, author) {
  const category = Categories[categoryKey];
  const commandsArray = Array.from(commands.values());

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${category?.emoji || "📋"} ${category?.name || categoryKey}`,
      iconURL: author.client.user.displayAvatarURL(),
    })
    .setColor('#0099ff')
    .setDescription(
      `All commands in the **${category?.name || categoryKey}** category:`
    )
    .setTimestamp();

  // Separate prefix commands and slash commands
  const prefixCommands = commandsArray.filter((cmd) => !cmd.isSlash);
  const slashCommands = commandsArray.filter((cmd) => cmd.isSlash);

  // Add prefix commands field
  if (prefixCommands.length > 0) {
    const prefixCommandList = prefixCommands.map((cmd) => cmd.name).join(", ");
    embed.addFields({
      name: "**Prefix Commands**",
      value: `\`${prefixCommandList}\``,
      inline: false,
    });
  }

  // Add slash commands field
  if (slashCommands.length > 0) {
    const slashCommandList = slashCommands.map((cmd) => cmd.name).join(", ");
    embed.addFields({
      name: "**Slash Commands**",
      value: `\`${slashCommandList}\``,
      inline: false,
    });
  } else {
    embed.addFields({
      name: "**Slash Commands**",
      value: "`This category has no slash commands`",
      inline: false,
    });
  }

  // Add aliases field
  const allAliases = [];
  commandsArray.forEach((cmd) => {
    if (cmd.aliases && cmd.aliases.length > 0) {
      allAliases.push(...cmd.aliases);
    }
  });

  if (allAliases.length > 0) {
    const aliasesList = allAliases.join(", ");
    embed.addFields({
      name: "**Aliases**",
      value: `\`${aliasesList}\``,
      inline: false,
    });
  } else {
    embed.addFields({
      name: "**Aliases**",
      value: "`This category has no aliases`",
      inline: false,
    });
  }

  embed.setFooter({
    text: `Category: ${category?.name || categoryKey} • ${commands.size} commands`,
    iconURL: author.displayAvatarURL(),
  });

  return embed;
}

function getClosestMatches(input, choices, maxMatches = 3) {
  try {
    const matches = [];
    const inputLower = typeof input === "string" ? input.toLowerCase() : "";
    for (const choice of choices) {
      if (typeof choice !== "string") continue;
      const choiceLower = choice.toLowerCase();
      if (
        choiceLower.includes(inputLower) ||
        inputLower.includes(choiceLower)
      ) {
        matches.push(choice);
      }
    }
    return matches.slice(0, maxMatches);
  } catch (error) {
    console.error("getClosestMatches error:", error);
    return [];
  }
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
