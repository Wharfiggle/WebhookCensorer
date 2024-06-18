const express = require("express");
const app = express();

app.listen(3002, () => 
{ console.log("Project is running!"); });

app.get("/", (req, res) => 
{ res.send("Hello world!"); });

// Require the necessary discord.js classes
const fs = require("node:fs");
const path = require("node:path");
//this is called object destructuring
//creates a new const variable for each element in the {} and assigns them
//the values of the variables with the same names from the required module (discord.js)
const { Client, Collection, GatewayIntentBits } = require("discord.js");

// Create a new client instance
const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent ] });

client.commands = new Collection();
client.cooldowns = new Collection();

//set up all commands in commands folder
const foldersPath = path.join(__dirname, "commands"); //append "commands" to directory path to get path to commands folder
const commandFolders = fs.readdirSync(foldersPath); //get all folders in commands folder
for(const folder of commandFolders) //iterate through each folder in commands folder
{
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js")); //get all js files in folder
	for(const file of commandFiles)
	{
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if("data" in command && "execute" in command)
			client.commands.set(command.data.name, command);
		else
			//			V backticks, not apostrophes. Can only do string interpolation with backticks
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

//set up all events in events folder
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for(const file of eventFiles)
{
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if(event.once)
		client.once(event.name, (...args) => event.execute(...args));
	else
		client.on(event.name, (...args) => event.execute(...args));
}

//function that takes in a string and returns an array of arrays of size 2:
//0th element: the word, 1st element: the word's location in the string
function getBadWords(string)
{
	return [""];
}

var webhooks = [];
client.on('messageCreate', async (message) =>
{
	if(!message.webhookId) //not a webhook
		return;

	if(webhooks.length > 0 && webhooks[0].id == message.webhookId) //webhook is ours
		return;

	console.log("!!!!!!!!!!!!!!!!!!!!!");
	console.log(message.author.username + " said: ");
	console.log(message.content);
	const badWordsName = getBadWords(message.author.username);
	const badWordsMsg = getBadWords(message.content);
	
	if(badWordsName.length == 0 && badWordsMsg.length == 0) //nothing to censor
		return;

	try
	{
		//find our webhook among the previously used webhooks
		var webhook;
		for(w of webhooks)
		{
			if(w.channel == message.channel)
			{
				webhook = w;
				break;
			}
		}

		if(!webhook) //havent used the needed webhook yet
		{
			//find our webhook
			const foundWebhooks = await message.channel.fetchWebhooks();
			webhook = foundWebhooks.find(wh => wh.token);

			if(!webhook) //have not created a webhook in this channel so need to create one
			{
				await message.channel.createWebhook({ name: 'WebhookCensorer' })
				.then(createdWebhook => 
				{
					webhook = createdWebhook;
					console.log(`Created webhook ${webhook.name}`);
				})
				.catch(createError =>
				{
					console.error(`Error while creating webhook: `, createError);
					return;
				});
			}

			webhooks.push(webhook);
			if(webhooks.length == 1 && webhook.id == message.webhookId) //webhook is ours
				return;
		}

		await webhook.send(
		{
			content: 'Yeah okay buddy!',
			username: message.author.username,
			avatarURL: message.author.displayAvatarURL()
		});
	}
	catch(error) { console.error('Error trying to send a message: ', error); }
});

// Log in to Discord with your client's token
const { token } = require("./config.json");
client.login(token);
