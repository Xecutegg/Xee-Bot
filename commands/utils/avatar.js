import {
    MessageFlags,
    TextDisplayBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    ThumbnailBuilder,
} from "discord.js";

export default {
    name: "avatar",
    description: "Show a user's avatar and download links (png/jpg/webp)",
    category: "UTILS",
    botperms: ["EmbedLinks"],
    userperms: ["SendMessages"],
    cooldown: 5,
    aliases: ["avater", "av", "pfp"],
    is_premium: false,

    async execute(client, message, args) {
        const response = await buildAvatarComponent(client, message, args);
        await message.reply(response);
    },
};

function findUser(client, message, args) {
    if (message.mentions && message.mentions.users.size) return message.mentions.users.first();

    if (args && args[0]) {
        const raw = args[0].replace(/[<@!>]/g, "");
        // try by id
        const byId = client.users.cache.get(raw);
        if (byId) return byId;

        // try by username (full name or joined args)
        const query = args.join(" ").toLowerCase();
        const byName = client.users.cache.find(u => u.username.toLowerCase() === query || `${u.username.toLowerCase()}#${u.discriminator}` === query);
        if (byName) return byName;
    }

    return message.author;
}

async function buildAvatarComponent(client, message, args) {
    try {
        const user = findUser(client, message, args);

        const avatarThumb = user.displayAvatarURL({ size: 256, dynamic: true });

        const pngUrl = user.displayAvatarURL({ format: "png", size: 1024, dynamic: true });
        const jpgUrl = user.displayAvatarURL({ format: "jpg", size: 1024, dynamic: false });
        const webpUrl = user.displayAvatarURL({ format: "webp", size: 2048, dynamic: true });

        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `# Avatar — ${user.tag}\n` +
                            `Requested by ${message.author.tag}`
                        )
                    )
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarThumb))
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Download (click to open):**\nPNG, JPG and WEBP versions are provided.`
                        )
                    )
                    .setButtonAccessory(
                        new ButtonBuilder().setLabel("PNG (1024)").setStyle(ButtonStyle.Link).setURL(pngUrl)
                    )
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("JPG version")
                    )
                    .setButtonAccessory(
                        new ButtonBuilder().setLabel("JPG (1024)").setStyle(ButtonStyle.Link).setURL(jpgUrl)
                    )
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("WEBP version")
                    )
                    .setButtonAccessory(
                        new ButtonBuilder().setLabel("WEBP (2048)").setStyle(ButtonStyle.Link).setURL(webpUrl)
                    )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
    } catch (error) {
        console.error("avatar command error:", error);
        return { content: "Something went wrong while fetching the avatar.", flags: 64 };
    }
}
