import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags, ButtonBuilder, ButtonStyle, PermissionsBitField } from 'discord.js';
import Idp from '../database/models/idp.js';

export default {
    name: 'interactionCreate',
    async execute(interaction, client) {

        if (interaction.isButton()) {
            if (interaction.customId === 'sendidp') {
                const hasAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
                const hasRequiredRole = interaction.member?.roles?.cache.has('1384526510064533535');

                if (!hasAdmin && !hasRequiredRole) {
                    return interaction.reply({
                        content: 'Yehi Button Sirf Moderators ke liye hai! Kripiya Management Team ko he use krne de.',
                        flags: 64
                    });
                }

                const db = await Idp.findOne({
                    channelID: interaction.channel.id,
                    guildID: interaction.guild.id
                });

                if (!db) {
                    return interaction.reply({
                        content: '❌ No IDP setup found for this channel!',
                        flags: 64
                    });
                }

                // Create modal for ID and Password
                const modal = new ModalBuilder()
                    .setCustomId('idpmodal')
                    .setTitle('Enter Your IDP Details');

                const idInput = new TextInputBuilder()
                    .setCustomId('idpid')
                    .setLabel('Your ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter your game ID')
                    .setRequired(true);

                const passwordInput = new TextInputBuilder()
                    .setCustomId('idppassword')
                    .setLabel('Password (Optional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter password if required')
                    .setRequired(false);

                const firstRow = new ActionRowBuilder().addComponents(idInput);
                const secondRow = new ActionRowBuilder().addComponents(passwordInput);
                modal.addComponents(firstRow, secondRow);

                await interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('sendto_')) {
                const hasAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
                const hasRequiredRole = interaction.member?.roles?.cache.has('1384526510064533535');

                if (!hasAdmin && !hasRequiredRole) {
                    return interaction.reply({
                        content: 'Yehi Button Sirf Moderators ke liye hai! Kripiya Management Team ko he use krne de.\n\n **Fir V agr apko apni ma chudani h to or jor se dabao and or gali kha lo madarchod!**',
                        flags: 64
                    });
                }

                const messageId = interaction.customId.split('_')[1];

                const modal = new ModalBuilder()
                    .setCustomId(`sendtochannel_${messageId}`)
                    .setTitle('Send to Channel');

                const channelInput = new TextInputBuilder()
                    .setCustomId('channelid')
                    .setLabel('Channel ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter the channel ID')
                    .setRequired(true);

                const firstRow = new ActionRowBuilder().addComponents(channelInput);
                modal.addComponents(firstRow);

                await interaction.showModal(modal);
            }
        }

        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'idpmodal') {
                await interaction.deferReply({ flags: 64 });

                const userId = interaction.fields.getTextInputValue('idpid');
                const password = interaction.fields.getTextInputValue('idppassword') || 'N/A';

                const db = await Idp.findOne({
                    channelID: interaction.channel.id,
                    guildID: interaction.guild.id
                });

                if (!db) {
                    return interaction.editReply({
                        content: '❌ IDP setup not found!',
                        flags: 64
                    });
                }

                // Send IDP response using Components V2
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `# ${db.title || 'IDP Response'}`
                        )
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `\`\`\`\n` +
                            `ID : ${userId}\n` +
                            `Password : ${password}\n` +
                            `Game Map : ${db.map || 'N/A'}\n` +
                            `Start Time: ${db.startTime || 'N/A'}\n\`\`\`\n` +
                            `${db.message || 'No message provided'}`
                        )
                    );

                // Add role mention if roleID exists
                if (db.roleID) {
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `<@&${db.roleID}>`
                        )
                    );
                }

                // Add uploaded by with Send to button
                const sendToButton = new ButtonBuilder()
                    .setCustomId(`sendto_temp`)
                    .setLabel('Send to')
                    .setStyle(ButtonStyle.Primary);

                container.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `*Uploaded by ${interaction.user.username}*`
                            )
                        )
                        .setButtonAccessory(sendToButton)
                );

                const sentMessage = await interaction.channel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });

                // Update button with actual message ID
                sendToButton.setCustomId(`sendto_${sentMessage.id}`);

                container.components[container.components.length - 1] = new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `*Uploaded by ${interaction.user.username}*`
                        )
                    )
                    .setButtonAccessory(sendToButton);

                await sentMessage.edit({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });

                await interaction.editReply({
                    content: '✅ Successfully Send Idp On this chnnenl!',
                    flags: 64
                });
            }

            if (interaction.customId.startsWith('sendtochannel_')) {
                const hasAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
                const hasRequiredRole = interaction.member?.roles?.cache.has('1384526510064533535');

                if (!hasAdmin && !hasRequiredRole) {
                    return interaction.reply({
                        content: 'Yehi Button Sirf Managment ke liye hai! Kripiya Management Team ko he use krne de',
                        flags: 64
                    });
                }

                await interaction.deferReply({ flags: 64 });

                const messageId = interaction.customId.split('_')[1];
                const channelId = interaction.fields.getTextInputValue('channelid');

                try {
                    const targetChannel = await client.channels.fetch(channelId);

                    if (!targetChannel) {
                        return interaction.editReply({
                            content: '❌ Channel not found or bot does not have access to it!',
                            flags: 64
                        });
                    }

                    if (!targetChannel.isTextBased()) {
                        return interaction.editReply({
                            content: '❌ That is not a text channel!',
                            flags: 64
                        });
                    }

                    // Get the original message
                    const originalMessage = await interaction.channel.messages.fetch(messageId);

                    if (!originalMessage) {
                        return interaction.editReply({
                            content: '❌ Original IDP message not found!',
                            flags: 64
                        });
                    }

                    // Send to target channel
                    await targetChannel.send({
                        components: originalMessage.components,
                        flags: MessageFlags.IsComponentsV2
                    });

                    await interaction.editReply({
                        content: `✅ IDP sent successfully to <#${channelId}>!`,
                        flags: 64
                    });

                } catch (error) {
                    console.error('Error sending to channel:', error);
                    await interaction.editReply({
                        content: '❌ Failed to send IDP. Make sure the channel ID is correct and bot has access!',
                        flags: 64
                    });
                }
            }
        }
    }
};
