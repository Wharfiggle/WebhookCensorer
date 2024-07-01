const { SlashCommandBuilder } = require("discord.js");

module.exports = 
{
    publicCommand: true, //WILL BE DEPLOYED GLOBALLY
	cooldown: 5,
	data: new SlashCommandBuilder().setName("purge").setDescription("Purge a number of messages from this channel, starting at the newest.")
	.addIntegerOption(option =>
		option.setName("number")
			.setDescription("The number of messages to purge.")
			.setRequired(true)),
	async execute(interaction)
	{
        const numMessages = interaction.options.getInteger("number");
		const messages = await interaction.channel.messages.fetch({ limit: numMessages });
		for(m of messages)
		{
			m[1].delete();
		}
		await interaction.reply({ content: `Successfully deleted ${numMessages} messages.`, ephemeral: true });
	},
};