import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags, ButtonBuilder, ButtonStyle, PermissionsBitField } from 'discord.js';
import Idp from '../database/models/idp.js';
import config from '../config.js';

export default {
    name: 'interactionCreate',
    async execute(interaction, client) {

        if (interaction.isButton()) {
            if (interaction.customId === 'sendidp') {
                const hasAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
                const hasRequiredRole = interaction.member?.roles?.cache.has('1384526510064533535') ||
                    interaction.member?.roles?.cache.has('1487115999710019594') || interaction.member?.roles?.cache.has('1419275730084434022');

                if (!hasAdmin && !hasRequiredRole) {
                    return interaction.reply({
                        content: 'This Button is only for Moderators! Please let the Management Team use it.\n\n **If you still want to press it, go ahead and press it hard and curse more!**',
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
                    });
                }

                const db = await Idp.findOne({
                    channelID: interaction.channel.id,
                    guildID: interaction.guild.id
                });

                if (!db) {
                    return interaction.reply({
                        content: '❌ No IDP setup found for this channel!',
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
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

                try {
                    await interaction.showModal(modal);
                } catch (error) {
                    console.error('Error showing modal:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ Failed to show the modal. Please try again.',
                            flags: 64,
                            allowedMentions: { parse: [], repliedUser: false }
                        });
                    }
                }
            }

            if (interaction.customId.startsWith('sendto_')) {
                const hasAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
                const hasRequiredRole = interaction.member?.roles?.cache.has('1384526510064533535') || interaction.member?.roles?.cache.has('1487115999710019594') || interaction.member?.roles?.cache.has('1419275730084434022');

                if (!hasAdmin && !hasRequiredRole) {
                    return interaction.reply({
                        content: 'This Button is only for Moderators! Please let the Management Team use it.\n\n **If you still want to press it, go ahead and press it hard and curse more!**',
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
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

                const roleInput = new TextInputBuilder()
                    .setCustomId('roleid')
                    .setLabel('Role ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter the role ID to mention')
                    .setRequired(true);

                const firstRow = new ActionRowBuilder().addComponents(channelInput);
                const secondRow = new ActionRowBuilder().addComponents(roleInput);
                modal.addComponents(firstRow, secondRow);

                try {
                    await interaction.showModal(modal);
                } catch (error) {
                    console.error('Error showing modal:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ Failed to show the modal. Please try again.',
                            flags: 64,
                            allowedMentions: { parse: [], repliedUser: false }
                        });
                    }
                }
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
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
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
                    content: `${config.check_emoji} | IDP SEND KR DIYAA!`,
                    flags: 64,
                    allowedMentions: { parse: [], repliedUser: false }
                });
            }

            if (interaction.customId.startsWith('sendtochannel_')) {
                const hasAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
                const hasRequiredRole = interaction.member?.roles?.cache.has('1384526510064533535') || interaction.member?.roles?.cache.has('1487115999710019594') || interaction.member?.roles?.cache.has('1419275730084434022');

                if (!hasAdmin && !hasRequiredRole) {
                    return interaction.reply({
                        content: 'This Button is only for Moderators! Please let the Management Team use it.\n\n **If you still want to press it, go ahead and press it hard and curse more!**',
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
                    });
                }

                await interaction.deferReply({ flags: 64 });

                const messageId = interaction.customId.split('_')[1];
                const channelId = interaction.fields.getTextInputValue('channelid');
                const roleId = interaction.fields.getTextInputValue('roleid') || null;

                try {
                    const targetChannel = await client.channels.fetch(channelId);

                    if (!targetChannel) {
                        return interaction.editReply({
                            content: '❌ Channel not found or bot does not have access to it!',
                            flags: 64,
                            allowedMentions: { parse: [], repliedUser: false }
                        });
                    }

                    if (!targetChannel.isTextBased()) {
                        return interaction.editReply({
                            content: '❌ That is not a text channel!',
                            flags: 64,
                            allowedMentions: { parse: [], repliedUser: false }
                        });
                    }

                    // Get the original message
                    const originalMessage = await interaction.channel.messages.fetch(messageId);

                    if (!originalMessage) {
                        return interaction.editReply({
                            content: '❌ Original IDP message not found!',
                            flags: 64,
                            allowedMentions: { parse: [], repliedUser: false }
                        });
                    }

                    // Extract ID and Password from the original message
                    let userId = 'N/A';
                    let userPassword = 'N/A';

                    if (originalMessage.components && originalMessage.components.length > 0) {
                        const messageContent = originalMessage.components[0]?.components || [];
                        for (const component of messageContent) {
                            if (component.data?.content) {
                                const content = component.data.content;
                                const idMatch = content.match(/ID\s*:\s*([^\n]+)/);
                                const passMatch = content.match(/Password\s*:\s*([^\n]+)/);
                                if (idMatch) userId = idMatch[1].trim();
                                if (passMatch) userPassword = passMatch[1].trim();
                            }
                        }
                    }

                    // Get the IDP data from database to resend with same format
                    const db = await Idp.findOne({
                        channelID: interaction.channel.id,
                        guildID: interaction.guild.id
                    });

                    if (db) {
                        // Recreate the Components V2 container same as original
                        const container = new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `# ONE DREAM T3 SCRIMS IDP`
                                )
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `\`\`\`\n` +
                                    `ID : ${userId}\n` +
                                    `Password : ${userPassword}\n` +
                                    `Game Map : ${db.map || 'N/A'}\n` +
                                    `Start Time: ${db.startTime || 'N/A'}\n\`\`\`\n` +
                                    `${db.message || 'No message provided'}`
                                )
                            );

                        // Add role mention if roleID exists
                        if (roleId) {
                            container.addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `<@&${roleId}>`
                                )
                            );
                        }

                        // Add forwarded by text
                        container.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `*Forwarded by ${interaction.user.username}*`
                            )
                        );

                        await targetChannel.send({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }

                    await interaction.editReply({
                        content: `${config.check_emoji} | Done Bhai IDP Send Kr Diya Ab Mere Malik Ko Paise Dedo [Check kro](https://founder.onedreamesports.in)`,
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
                    });

                } catch (error) {
                    console.error('Error sending to channel:', error);
                    console.error('Error details:', error.message);
                    await interaction.editReply({
                        content: `❌ Error: ${error.message}`,
                        flags: 64,
                        allowedMentions: { parse: [], repliedUser: false }
                    });
                }
            }
        }
    }
};
