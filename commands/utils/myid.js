export default {
    name: 'myid',
    aliases: ['getid', 'userid'],
    category: 'UTILS',
    description: 'Get your Discord user ID',
    async execute(client, message, args) {
        return message.reply(`Your Discord ID is: \`${message.author.id}\``);
    }
};
