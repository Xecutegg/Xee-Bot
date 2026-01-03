import { getSettings } from "../../database/models/Guild.js";

export default {
  name: 'interactionCreate',
  isEvent: true,
  type: 'interactionCreate',
  execute: async (client, interaction) => {
    // Only handle Buttons and Select Menus
    if (![2, 3].includes(interaction.componentType)) return;

    try {
      // Extract custom ID and get command from client.commands
      let customId = interaction.customId.split("-")[0];
      let command = client.commands.get(customId);

      if (!command) return;

      // Check if interaction type matches command type
      const expectedType = interaction.componentType === 2 ? "button" : "select";
      if (command.type !== expectedType) return;

      // Check for premium lock?
      let guild_settings = await getSettings(interaction.guild.id);
      if (command.is_premium && !guild_settings.isPremium) {
        return interaction.reply({
          content: "This interaction is only for premium, consider upgrading to premium to use this feature.",
          flags: [64]
        });
      }

      // Execute interaction logic
      await command.execute(client, interaction).catch(() => { });

    } catch (error) {
      console.error(`❌ Interaction Error for ${interaction.user.id}:`, error);
    }
  }
};
