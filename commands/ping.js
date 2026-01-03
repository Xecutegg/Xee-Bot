import { EmbedBuilder } from "discord.js";
import mongoose from "mongoose";

async function getMongoDbPing() {
  const start = Date.now();
  try {
    if (mongoose.connection.readyState === 0) {
      console.warn("MongoDB connection not established");
      return "Not Connected";
    }
    await mongoose.connection.db.admin().ping();
    return Date.now() - start;
  } catch (error) {
    console.error("MongoDB ping failed:", error);
    return "Error";
  }
}

export default {
  name: "ping",
  description: "Shows the current latency of EliteQ",
  category: "UTILS",
  botperms: ["SendMessages"],
  userperms: ["SendMessages"],
  is_premium: false,
  cooldown: 5,
  async execute(client, message, args) {
    const embed = await createPingEmbed(client, message);
    await message.reply({ embeds: [embed] });
  },
};

async function createPingEmbed(client, message) {
  // Get pings
  const wsPing = Math.floor(client.ws.ping);
  const dbPing = await getMongoDbPing();

  // Determine status emoji and color
  const totalPing = wsPing + (typeof dbPing === "number" ? dbPing : 0);
  let status, color;

  if (totalPing < 200) {
    status = "<a:greendot:1380120847356006432> Excellent Latency";
    color = 0x2ecc71; // Green
  } else if (totalPing < 500) {
    status = "<a:yellowddot:1380121000326205500> Good Latency";
    color = 0xf1c40f; // Yellow
  } else {
    status = "<a:reddot:1380120744163278989> High Latency";
    color = 0xe74c3c; // Red
  }

  // Create embed
  const user = message?.author || {
    username: "User",
    displayAvatarURL: () => client.user.displayAvatarURL(),
  };
  return new EmbedBuilder()
    .setAuthor({
      name: user.username,
      iconURL: user.displayAvatarURL(),
    })
    .setThumbnail(client.user.displayAvatarURL())
    .setColor(color)
    .addFields(
      {
        name: "<:discord:1380125979892121641> Bot Latency",
        value: `\`${wsPing}ms\``,
        inline: false,
      },
      {
        name: "<:stack:1380126122317971500> Database Latency",
        value: `\`${typeof dbPing === "number" ? `${dbPing}ms` : dbPing}\``,
        inline: false,
      },
      {
        name: "<:statuts:1380126204081995876> Status",
        value: status,
        inline: false,
      }
    )
    .setTimestamp();
}
