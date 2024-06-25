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



//		custom code for webhook censorer

const readline = require('readline');
var badWordLines;

//reads badwords.txt and parses data
async function readTextFile()
{
	const fileStream = fs.createReadStream("./badwords.txt");
	const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
	//we use the crlfDelay option to recognize all instances of CR LF ('\r\n') in input.txt as a single line break
	var lines = [];
	for await(line of rl) //for each line in the text file 
	{
		const words = line.split(/\s+/); //split line into array of words by whitespace
		while(lines.length < words.length)
		{ lines.push([]); }
		lines[words.length - 1].push(words); //lines[0] = array of all lines with 1 word, lines[1] = all lines with 2 words, etc
	}
	return lines;
}

//function that takes in a string and returns the string with any detected bad words censored out
async function getCensoredString(string)
{
	if(string == null)
		return null;

	if(!badWordLines) //if text file hasnt been read then read it
		badWordLines = await readTextFile();

	var badWords = [];
	const regMatchWords = [...string.matchAll(/([^A-Za-z\s]?\w+)+(?=\s|$|[^A-Za-z\s])/g)];
	var strWords = [];
	//make array of just the strings from regex matches
	for(word of regMatchWords)
	{ strWords.push(word[0]); }
	//make copy of strWords
	const strWordsOrig = [...strWords];
	for(var wordCount = badWordLines.length - 1; wordCount >= 0; wordCount--)
	{
		if(wordCount >= strWords.length) //if this section of bad words has more words than our string, dont bother processing it
			continue;
		for(line of badWordLines[wordCount])
		{
			for(var i = 0; i < strWords.length - wordCount; i++)
			{
				for(var w = 0; w < line.length; w++)
				{
					if(strWords[w + i].toLowerCase() != line[w].toLowerCase())
						break;
					else if(w == line.length - 1) //made it to the end of the bad word line without finding any mismatches
					{
						strWords.splice(i, line.length); //remove words from strWords to focus on processing the rest of the string
						//push each word's index to badWords
						for(var j = 0; j < line.length; j++)
						{ badWords.push(i + j); }
						i -= 1;
					}
				}
			}
		}
	}
	
	if(badWords.length < 1) //no bad words detected, return original string
		return string;

	const censoredCharacters = ['!', '@', '$', '%', '^', '&'];
	var charsLeft = [...censoredCharacters];

	//assemble final string with bad words replaced with chars from censoredCharacters
	var finalString = "";
	for(var i = 0; i < strWordsOrig.length; i++)
	{
		if(badWords.includes(i))
		{
			for(j in strWordsOrig[i])
			{
				const rn = Math.floor(Math.random() * charsLeft.length);
				const char = charsLeft.splice(rn, 1)[0]; //remove and store last used character so we cant use the same character twice in a row
				finalString += char;
				if(charsLeft.length == 0)
				{
					charsLeft = [...censoredCharacters];
					charsLeft.splice(charsLeft.indexOf(char), 1); //remove last used character
				}
			}
		}
		else
			finalString += strWordsOrig[i]
		
		if(i < strWordsOrig.length - 1)
			finalString += " ";
	}

	return finalString;
}

const webhooks = new Collection();
client.on('messageCreate', async (message) =>
{
	var isWebhook = false;
	if(message.webhookId) //is a webhook
	{
		isWebhook = true;
		if(webhooks.length > 0 && webhooks[0].id == message.webhookId) //webhook is ours
			return;
	}

	if(isWebhook)
		var username = message.author.username; //webhook nickname
	else
		username = message.member.nickname; //user nickname
	const censoredName = await getCensoredString(username);
	const censoredMsg = await getCensoredString(message.content);

	if(censoredName == username && censoredMsg == message.content) //nothing to censor
		return;

	console.log(`${message.author.username} said: ${message.content}`);

	//get appropriate webhook and send message with it
	try
	{
		//find our webhook among the previously used webhooks
		var webhook = webhooks.get(message.channel);

		if(!webhook) //havent used the needed webhook yet
		{
			//find our webhook in the server
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

			webhooks.set(webhook.channel, webhook);
		}

		await webhook.send(
		{
			content: censoredMsg,
			username: censoredName,
			avatarURL: message.author.displayAvatarURL()
		});

		message.delete();
	}
	catch(error) { console.error('Error trying to send a message: ', error); }
});



// Log in to Discord with your client's token
const { token } = require("./config.json");
client.login(token);
