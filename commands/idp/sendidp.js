import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } from "discord.js";
import Idp from '../../database/models/idp.js';

export default {
    name: 'idp-setup',
    userPermissions: ['ManageGuild'],
    botPermissions: ['ManageGuild'],
    category: 'idp',
    description: 'Set up an IDP (Interactive Data Panel)',
    usage: 'idp-setup',
    async execute(client, message, args) {

        const embedButton = new ButtonBuilder()
            .setCustomId('embedmsg')
            .setLabel('Embed Message')
            .setStyle(ButtonStyle.Secondary);

        const templateButton = new ButtonBuilder()
            .setCustomId('template')
            .setLabel('Template of IDP')
            .setStyle(ButtonStyle.Secondary);

        const sendButton = new ButtonBuilder()
            .setCustomId('sendembed')
            .setLabel('Send Embed')
            .setStyle(ButtonStyle.Success);

        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `# IDP Setup Panel\n\n` +
                            `Hello **${message.author.displayName}**, Welcome to the IDP configuration!\n\n` +
                            `Use the buttons below to set up your **IDP details step-by-step**.\n` +
                            `Make sure all information is accurate before completing the setup.`
                        )
                    )
                    .setButtonAccessory(embedButton)
            )

            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('Click here to set template data')
                    )
                    .setButtonAccessory(templateButton)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('Ready to send? Click here')
                    )
                    .setButtonAccessory(sendButton)
            );

        const msg = await message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 600_000 });


        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: 'This is not for you!', flags: 64 });
            }
            const db = await Idp.findOne({ channelID: message.channel.id, guildID: message.guild.id });

            if (i.customId === 'embedmsg') {
                await handleEmbedMsg(client, message, i, db);
            }
            if (i.customId === 'template') {
                if (!db) return i.reply({ content: 'First You Need To Provide Embed Message...', flags: 64 });
                await handleTemplate(client, message, i);
            }

            if (i.customId === 'sendembed') {
                if (!db) return i.reply({ content: 'First You Need To Provide Embed Message...', flags: 64 });
                if (!db.message) return i.reply({ content: 'First You Need To Provide Template Data...', flags: 64 });
                if (!db.title) return i.reply({ content: 'First You Need To Provide Template Data...', flags: 64 });

                const sendIdpButton = new ButtonBuilder()
                    .setCustomId('sendidp')
                    .setLabel('SEND IDP')
                    .setStyle(ButtonStyle.Danger);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `# ${db.title || 'IDP'}\n\n${db.embedMsg}`
                                )
                            )
                            .setButtonAccessory(sendIdpButton)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `*MAP: ${db.map} | START TIME: ${db.startTime}*`
                        )
                    );

                await i.reply({ content: 'IDP Embed Created! Click the button below to send it.', flags: 64 });
                await i.channel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
                collector.stop();
            }
        });

    },
};

async function handleTemplate(client, message, i) {
    const model = new ModalBuilder()
        .setCustomId('modeltemplate')
        .setTitle('Template of IDP in 10 Min...');

    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter The Title Of IDP')
        .setRequired(true);

    const mapInput = new TextInputBuilder()
        .setCustomId('map')
        .setLabel('Map')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter The Map Of IDP')
        .setRequired(true);

    const startTimeInput = new TextInputBuilder()
        .setCustomId('startTime')
        .setLabel('Start Time')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter The Start Time Of IDP')
        .setRequired(true);

    const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('Message')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter The Message Of IDP')
        .setRequired(true);

    const idpRoleInput = new TextInputBuilder()
        .setCustomId('idprole')
        .setLabel('IDP ROLE')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter The ROLE ID Of IDP')
        .setRequired(true);
    // Put each TextInput in its own ActionRow:
    const firstRow = new ActionRowBuilder().addComponents(titleInput);
    const secondRow = new ActionRowBuilder().addComponents(mapInput);
    const thirdRow = new ActionRowBuilder().addComponents(startTimeInput);
    const fourthRow = new ActionRowBuilder().addComponents(messageInput);
    const fifthRow = new ActionRowBuilder().addComponents(idpRoleInput);

    model.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

    await i.showModal(model);
    const modelInteraction = await i.awaitModalSubmit({ time: 600_000 });
    if (!modelInteraction) return i.followUp({ content: 'You did not provide the data in time!', flags: 64 });
    await modelInteraction.deferUpdate();
    const title = modelInteraction.fields.getTextInputValue('title');
    const map = modelInteraction.fields.getTextInputValue('map');
    const startTime = modelInteraction.fields.getTextInputValue('startTime');
    const msg = modelInteraction.fields.getTextInputValue('message');
    const roleInput = modelInteraction.fields.getTextInputValue('idprole');

    // Validate title length
    if (title.length > 100) {
        return modelInteraction.followUp({
            content: '❌ Title must be 100 characters or less!',
            flags: 64
        });
    }

    // Validate map length
    if (map.length > 50) {
        return modelInteraction.followUp({
            content: '❌ Map name must be 50 characters or less!',
            flags: 64
        });
    }

    // Validate message length
    if (msg.length > 500) {
        return modelInteraction.followUp({
            content: '❌ Message must be 500 characters or less!',
            flags: 64
        });
    }

    // Extract clean role ID from any format (plain ID or <@&ID>)
    const roleID = roleInput.replace(/[<@&>]/g, '');

    // Validate role ID format (Discord snowflakes are 17-19 digits)
    if (!/^\d{17,19}$/.test(roleID)) {
        return modelInteraction.followUp({
            content: '❌ Invalid role ID format! Please provide a valid role ID (17-19 digits).',
            flags: 64
        });
    }

    // Check if role exists in the guild
    try {
        const role = await message.guild.roles.fetch(roleID);
        if (!role) {
            return modelInteraction.followUp({
                content: '❌ Role not found in this server! Please provide a valid role ID.',
                flags: 64
            });
        }
    } catch (error) {
        return modelInteraction.followUp({
            content: '❌ Could not fetch role! Make sure the role ID is correct.',
            flags: 64
        });
    }

    await Idp.findOneAndUpdate({
        channelID: message.channel.id,
        guildID: message.guild.id,
    }, {
        title,
        map,
        startTime,
        message: msg,
        roleID,
    });
    await modelInteraction.followUp({
        content: '✅ Template Added Successfully! All validations passed.',
        flags: 64
    });

}



async function handleEmbedMsg(client, message, i, db) {
    const modal = new ModalBuilder()
        .setCustomId(`modelembedmsg`)
        .setTitle('Embed Message in 60 Sec...');

    const msgInput = new TextInputBuilder()
        .setCustomId('msgg')
        .setLabel('Message ')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter The Message Of Embed')
        .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(msgInput);
    modal.addComponents(firstRow);

    await i.showModal(modal);
    const modelInteraction = await i.awaitModalSubmit({ time: 60_000 });
    if (!modelInteraction) return i.followUp({ content: 'You did not provide the data in time!', flags: 64 });
    await modelInteraction.deferUpdate();
    const msg = modelInteraction.fields.getTextInputValue('msgg');

    // Validate message length
    if (msg.length < 10) {
        return modelInteraction.followUp({
            content: '❌ Message must be at least 10 characters long!',
            flags: 64
        });
    }

    if (msg.length > 1000) {
        return modelInteraction.followUp({
            content: '❌ Message must be 1000 characters or less!',
            flags: 64
        });
    }

    if (db) {
        await Idp.findOneAndUpdate({
            channelID: message.channel.id,
            guildID: message.guild.id,
        }, {
            embedMsg: msg,
        });
    } else {
        await Idp.create({
            channelID: message.channel.id,
            guildID: message.guild.id,
            embedMsg: msg,
        });
    }

    await modelInteraction.followUp({
        content: '✅ Embed Message Added Successfully!',
        flags: 64
    });

}
