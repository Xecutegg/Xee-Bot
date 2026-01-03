export default {
  name: "leaveserver",
  devOnly: true,
  category: "ONLYDEVS",
  description: "Leave a server.",
  usage: "leaveserver <serverId>",
  aliases: ["lg"],
  async execute(client, message, args) {
    if (!args.length) {
      return message.reply("Please provide a server ID to leave.");
    }

    const input = args[0];
    const guild = client.guilds.cache.get(input);

    if (!guild) {
      return message.reply(
        `No server found. Please provide a valid server id.\n` +
          `You may use findserver/listservers to find the server id`
      );
    }

    const name = guild.name;
    try {
      await guild.leave();
      return message.reply(`Successfully Left \`${name}\``);
    } catch (err) {
      console.error("GuildLeave Error:", err);
      return message.reply(`Failed to leave \`${name}\``);
    }
  },
};
