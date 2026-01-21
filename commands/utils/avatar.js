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
        const targetUser = findUser(client, message, args);

        const confirmId = `avatar_confirm_${message.id}_${message.author.id}`;
        const cancelId = `avatar_cancel_${message.id}_${message.author.id}`;

        const confirmContainer = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`Or Aa geya na *Madarchod** wapas se ladki dhekne? Dhek Dhek kaise Dhekne Aya h ${targetUser.tag} ki Pic Chal Confirm Krde Dikha Deta hu!!`)
                    )
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ size: 128, dynamic: true })))
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Confirm to view avatar"))
                    .setButtonAccessory(new ButtonBuilder().setCustomId(confirmId).setLabel("Confirm").setStyle(ButtonStyle.Primary))
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Cancel the request"))
                    .setButtonAccessory(new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setStyle(ButtonStyle.Secondary))
            );

        const confMsg = await message.reply({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });

        const filter = (i) => i.user.id === message.author.id && (i.customId === confirmId || i.customId === cancelId);
        const collector = confMsg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

        collector.on("collect", async (interaction) => {
            try {
                if (interaction.customId === cancelId) {
                    await interaction.update({ content: "Cancelled.", components: [] });
                    return;
                }

                // Confirmed
                await interaction.deferUpdate();
                const avatarPayload = buildAvatarContainer(targetUser, message);
                await confMsg.edit(avatarPayload);
            } catch (err) {
                console.error("avatar interaction error:", err);
                try {
                    await interaction.update({ content: "An error occurred.", components: [] });
                } catch { }
            }
        });

        collector.on("end", async (collected) => {
            if (collected.size === 0) {
                try {
                    await confMsg.edit({ content: "Timed out.", components: [] });
                } catch { }
            }
        });
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
    const user = findUser(client, message, args);
    return buildAvatarPayload(user, message);
}

function buildAvatarContainer(user, message) {
    const pngUrl = user.displayAvatarURL({ format: "png", size: 1024, dynamic: true });
    const jpgUrl = user.displayAvatarURL({ format: "jpg", size: 1024, dynamic: false });
    const webpUrl = user.displayAvatarURL({ format: "webp", size: 2048, dynamic: true });

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# Avatar — ${user.tag}\nRequested by ${message.author.tag}`)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ size: 256, dynamic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("Download (click links)"))
                .setButtonAccessory(new ButtonBuilder().setLabel("PNG (1024)").setStyle(ButtonStyle.Link).setURL(pngUrl))
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("JPG version"))
                .setButtonAccessory(new ButtonBuilder().setLabel("JPG (1024)").setStyle(ButtonStyle.Link).setURL(jpgUrl))
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("WEBP version"))
                .setButtonAccessory(new ButtonBuilder().setLabel("WEBP (2048)").setStyle(ButtonStyle.Link).setURL(webpUrl))
        );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
