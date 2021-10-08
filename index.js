// Runs the VPCC-Bot

require("dotenv").config();

const fs = require("fs");
const NodeCache = require("node-cache");
const Keyv = require("keyv");
const { KeyvFile } = require("keyv-file");
const { Client, Intents, CategoryChannel, Permissions, User } = require("discord.js");
const client = new Client({ intents: [ Intents.FLAGS.GUILDS ], rejectOnRateLimit: () => true });

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
});

// keyv-file based store (will be upgraded to use replit's built in key value store later)
const store = {
	keyv: new Keyv({
		store: new KeyvFile({
			filename: "store.json",
		}),
	}),
	async get(resource) {
		return (await this.keyv.get(resource)) ?? {};
	},
	async set(resource, data) {
		if (JSON.stringify(data) === "{}")
			return await this.keyv.delete(resource);
		else
			return await this.keyv.set(resource, data);
	},
	async modify(resource, callback) {
		const data = await get(this.keyv, resource);
		await callback(data);
		await set(this.keyv, resource, data);
	},
};

// Helper function to remove an element from an array
function removeFromArray(array, element) {
	const index = array.lastIndexOf(element);
	if (index !== -1)
		array.splice(index, 1);
}

// Asynchronous version of Array.prototype.find
async function findPredicate(array, predicate) {
	for (let i = 0; i < array.length; i++) {
		if (await predicate(array[i], i, array)) {
			return array[i];
		}
	}
	return undefined;
}

// - VPCC specific helper functions

// global cache object
const resources = {
	resourceSymbol: Symbol("resource"),
	cache: new NodeCache({ useClones: false }),
	store: store,
	// call with a resource string or an object with { resource, force = false, cache = true }
	fetch: async function(options) {
		if (typeof options === "string")
			options = { resource: options };
		let obj;
		if (!(options.force ?? false))
			obj = this.cache.get(options.resource);
		if (obj == null) {
			obj = await this.store.get(options.resource);
			if (options.cache ?? true)
				this.cache.set(options.resource, obj);
		}
		obj = Object.assign({}, obj);  // always return a copy of the object
		obj[this.resourceSymbol] = options.resource;
		return obj;
	},
	// update the resource object to the store
	push: async function(obj) {
		const resource = obj[this.resourceSymbol];
		this.cache.del(resource);
		return await this.store.set(resource, obj);
	},
	// invalidate the cache
	invalidate: async function() {
		this.cache.flushAll();
	},
};

// creates a "transaction" that updates all changed values at the end
function createTransaction(resources) {
	return {
		resources: resources,
		data: {},
		// call with a resource string or an object with resources.fetch.options
		fetch: async function(options) {
			if (typeof options === "string")
				options = { resource: options };
			return this.data[options.resource] ??= await this.resources.fetch(options);
		},
		// pushes all changes and clears data
		commit: async function() {
			for (const resource in this.data) {
				// future: check if something actually changed before pushing
				await this.resources.push(this.data[resource]);
				delete this.data[resource];
			}
		},
	};
}

// deletes all values from an object
function clearObject(obj) {
	for (const name in obj)
		delete obj[name];
}

// find user with matching requirements
async function findUser(resources, requirements, edit = false) {
	users:
	for (const userId of (await resources.fetch(`/users`)).userIds ?? []) {
		let user = await resources.fetch(`/user/${userId}`);
		for (const name in requirements)
			if (requirements[name] !== user[name])
				continue users;
		if (!edit)
			user = Object.assign({}, user);
		else
			user = await resources.fetch({ resource: `/user/${userId}`, edit });
		user.id ??= userId;
		return user;
	}
	return undefined;
}

// find team with matching requirements
async function findTeam(resources, requirements, edit = false) {
	teams:
	for (const teamId of (await resources.fetch(`/teams`)).teamIds ?? []) {
		let team = await resources.fetch(`/team/${teamId}`);
		for (const name in requirements)
			if (requirements[name] !== team[name])
				continue teams;
		if (!edit)
			team = Object.assign({}, team);
		else
			team = await resources.fetch({ resource: `/team/${teamId}`, edit });
		team.id ??= teamId;
		return team;
	}
	return undefined;
}

// find user with id
async function fetchUser(resources, userId, edit = false) {
	const user = await resources.fetch({ resource: `/user/${userId}`, edit });
	user.id ??= userId;
	return user;
}

// find teamId with id
async function fetchTeam(resources, teamId, edit = false) {
	const team = await resources.fetch({ resource: `/team/${teamId}`, edit });
	team.id ??= teamId;
	return team;
}

async function createUser(_guild, resources, { id, ...properties }) {
	const users = await resources.fetch({ resource: `/users`, edit: true });
	const user = await fetchUser(resources, id, true);
	// create user with properties
	Object.assign(user, properties);
	(users.userIds ??= []).push(user.id);
	return user;
}

async function createTeam(guild, resources, { id, ...properties }) {
	const teams = await resources.fetch({ resource: `/teams`, edit: true });
	const team = await fetchTeam(resources, id, true);
	// create team with properties
	Object.assign(team, properties);
	(teams.teamIds ??= []).push(team.id);
	// create team role
	const role = await guild.roles.create({ name: `Team ${team.name}` });
	team.discordRoleId = role.id;
	// create team text and voice channels
	const channelOptions = {
		parent: (await guild.channels.fetch()).find(channel => (
			channel instanceof CategoryChannel
			&& channel.name.toLowerCase() === "team"
		)),
		permissionOverwrites: [
			{ id: guild.roles.everyone, deny: [ Permissions.FLAGS.VIEW_CHANNEL ] },
			{ id: role, allow: [ Permissions.FLAGS.VIEW_CHANNEL ] },
		],
	};
	const textChannel = await guild.channels.create(`Team ${team.name}`, channelOptions);
	const voiceChannel = await guild.channels.create(`Team ${team.name}`, { type: "GUILD_VOICE", ...channelOptions });
	team.discordTextChannelId = textChannel.id;
	team.discordVoiceChannelId = voiceChannel.id;
	return team;
}

async function joinTeam(guild, _resources, team, user) {
	// join team
	(team.memberIds ??= []).push(user.id);
	user.teamId = team.id;
	// join team role
	const discordMember = await guild.members.fetch(user.discordUserId);
	await discordMember.roles.add(team.discordRoleId);
}

async function renameTeam(guild, _resources, team, name) {
	// rename team
	team.name = name;
	// rename team channels
	const textChannel = await guild.channels.fetch(team.discordTextChannelId);
	const voiceChannel = await guild.channels.fetch(team.discordVoiceChannelId);
	await textChannel.edit({ name: `Team ${name}` });
	await voiceChannel.edit({ name: `Team ${name}` });
	// rename role
	const role = await guild.roles.fetch(team.discordRoleId);
	await role.edit({ name: `Team ${name}` });
}

async function leaveTeam(guild, resources, user) {
	const team = await fetchTeam(resources, user.teamId, true);
	team.id ??= user.teamId;
	// leave team role
	const discordMember = await guild.members.fetch(user.discordUserId);
	await discordMember.roles.remove(team.discordRoleId);
	// leave team
	removeFromArray((team.memberIds ??= []), user.id);
	user.teamId = undefined;
}

async function destroyTeam(guild, resources, team) {
	const teams = await resources.fetch({ resource: `/teams`, edit: true });
	// remove team channels
	const textChannel = await guild.channels.fetch(team.discordTextChannelId);
	const voiceChannel = await guild.channels.fetch(team.discordVoiceChannelId);
	await textChannel.delete();
	await voiceChannel.delete();
	// remove team role
	const role = await guild.roles.fetch(team.discordRoleId);
	await role.delete();
	// remove team
	removeFromArray((teams.teamIds ??= []), team.id);
	clearObject(team);
}

// Process slash commands
client.on("interactionCreate", async interaction => {
	if (!interaction.isCommand())
		return;

	// defer reply cuz it might take a while maybe
	await interaction.deferReply();

	try {
		const metadata = {
			timestamp: Date.now(),
			userDisplayName: `${interaction.user.username}#${interaction.user.discriminator}`,
			userId: interaction.user.id,
		};

		if (interaction.commandName === "ping") {
			await interaction.editReply("pong");
			return;
		}

		if (interaction.commandName === "admin") {
			const owner = (await client.application.fetch()).owner;
			const userId = interaction.user.id;
			console.log(owner);
			if (!(owner instanceof User ? owner.id === userId : owner.members.has(userId))) {
				await interaction.editReply(`You are not the bot owner`);
				return;
			}
			const subcommandName = interaction.options.getSubcommand(true);
			if (subcommandName === "get") {
				const key = interaction.options.getString("key", true);
				console.log([ "admin", "get", key, metadata ]);
				const [resource, ...properties] = key.split(".");
				let result = await resources.fetch(resource.trim());
				for (const property of properties)
					result = result?.[property.trim()];
				let out;
				if (result === undefined)
					out = "*undefined*";
				else {
					const stringified = JSON.stringify(result, null, 2);
					if (stringified.includes("\n"))
						out = "```json\n" + stringified + "\n```";
					else
						out = "`" + stringified + "`";
				}
				await interaction.editReply(out);
				return;
			}
			if (subcommandName === "set") {
				const key = interaction.options.getString("key", true);
				const value = interaction.options.getString("value", true);
				console.log([ "admin", "set", key, value, metadata ]);
				const transaction = createTransaction(resources);
				const [resource, ...properties] = key.split(".");
				const last = properties.pop();
				let result = await transaction.fetch({ resource: resource.trim(), edit: true });
				for (const property of properties)
					result = result?.[property.trim()];
				if (result === undefined)
					throw new Error("cannot set property of undefined");
				if (last === undefined) {
					const v = Object.assign({}, result);  // for use in the eval
					clearObject(result);
					Object.assign(result, eval(`(${value})`));
				} else {
					const v = result[last] === undefined ? undefined : JSON.parse(JSON.stringify(result[last]));
					result[last] = eval(`(${value})`);
				}
				await transaction.commit();
				await interaction.editReply("*updated*");
				return;
			}
			if (subcommandName === "invalidate") {
				console.log([ "admin", "invalidate", metadata ]);
				await resources.invalidate();
				await interaction.editReply("*invalidated*");
				return;
			}
		}

		if (interaction.commandName === "profile") {
			const type = interaction.options.getString("type") || "user";
			if (type === "user") {
				console.log([ "profile", "user", metadata ]);
				// find user and create if doesnt exist
				let user = await findUser(resources, { discordUserId: interaction.user.id });
				if (!user) {
					const transaction = createTransaction(resources);
					user = await createUser(interaction.guild, transaction, { id: interaction.id, discordUserId: interaction.user.id });
					await transaction.commit();
				}
				// get current team / points / medals
				// get team
				const teamId = user.teamId;
				const teamName = teamId && (await fetchTeam(resources, teamId)).name;
				// get points this month
				const pointsThisMonth = [...user.pointEvents || []].reduce((points, { type, deltaPoints }) => {
					if (type == "add") {
						return points + deltaPoints;
					}
					if (type == "clear") {
						return 0;
					}
				}, 0);
				// get number of medals
				const numMedals = [...user.medalEvents || []].reduce((numMedals, { type }) => {
					if (type == "add") {
						return numMedals + 1;
					}
				}, 0);
				// build response
				const parts = [];
				parts.push(`Summary for ${metadata.userDisplayName}`);
				if (teamId)
					parts.push(`- Team: ${teamName}`);
				parts.push(`- Points this month: ${pointsThisMonth}`);
				parts.push(`- Medals: ${numMedals}`);
				// send response
				await interaction.editReply({ content: parts.join("\n"), allowedMentions: { parse: [] }});
				return;
			}
			if (type === "medals") {
				console.log([ "profile", "medals", metadata ]);
				await interaction.editReply(`haha lol ${type}`);
				return;
			}
			if (type == "points") {
				console.log([ "profile", "points", metadata ]);
				await interaction.editReply(`haha lol ${type}`);
				return;
			}
			if (type == "team") {
				console.log([ "profile", "team", metadata ]);
				await interaction.editReply(`haha lol ${type}`);
				return;
			}
		}

		if (interaction.commandName === "team") {
			const subcommandName = interaction.options.getSubcommand(true);
			if (subcommandName === "create") {
				const name = interaction.options.getString("name", true);
				console.log([ "team", "create", name, metadata ]);
				const transaction = createTransaction(resources);
				// fail if team exists
				if (await findTeam(transaction, { name }) != null) {
					await interaction.editReply(`Team called ${name} already exists`);
					return;
				}
				// fail if user exists and has a previous team
				let user = await findUser(transaction, { discordUserId: interaction.user.id }, true);
				if (user != null) {
					if (user.teamId != null) {
						await interaction.editReply(`You are still in a team`);
						return;
					}
				}
				// create user if doesnt exist
				if (user == null) {
					user = await createUser(interaction.guild, transaction, { id: interaction.id, discordUserId: interaction.user.id });
				}
				// create team
				const team = await createTeam(interaction.guild, transaction, { id: interaction.id, name });
				// join team
				await joinTeam(interaction.guild, transaction, team, user);
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Created and joined new team called ${name}`);
				return;
			}
			if (subcommandName === "join") {
				const name = interaction.options.getString("name", true);
				console.log([ "team", "join", name, metadata ]);
				// create transaction
				const transaction = createTransaction(resources);
				// find user
				let user = await findUser(transaction, { discordUserId: interaction.user.id }, true);
				// fail if user exists and has a previous team
				if (user != null) {
					if (user.teamId != null) {
						await interaction.editReply(`You are still in a team`);
						return;
					}
				}
				// create user if necessary
				if (user == null) {
					user = await createUser(interaction.guild, transaction, { id: interaction.id, discordUserId: interaction.user.id });
				}
				// fail if team doesnt exist
				const team = await findTeam(transaction, { name }, true);
				if (team == null) {
					await interaction.editReply(`Team called ${name} doesn't exist`);
					return;
				}
				// join team
				await joinTeam(interaction.guild, transaction, team, user);
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Joined team called ${name}`);
				return;
			}
			if (subcommandName === "leave") {
				console.log([ "team", "leave", metadata ]);
				const transaction = createTransaction(resources);
				// fail if user doesnt exist
				const user = await findUser(transaction, { discordUserId: interaction.user.id }, true);
				if (user == null) {
					await interaction.editReply(`You are not in a team`);
					return;
				}
				// fail if doesnt have a previous team
				if (user.teamId == null) {
					await interaction.editReply(`You are not in a team`);
					return;
				}
				// get team name
				const team = await fetchTeam(transaction, user.teamId, true);
				const teamName = team.name;
				// leave previous team
				await leaveTeam(interaction.guild, transaction, user);
				// remove team if empty
				if ((team.memberIds ?? []).length === 0) {
					await destroyTeam(interaction.guild, transaction, team);
				}
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Left team called ${teamName}`);
				return;
			}
			if (subcommandName === "rename") {
				const name = interaction.options.getString("name", true);
				console.log([ "team", "rename", name, metadata ]);
				const transaction = createTransaction(resources);
				// fail if user doesnt exist
				const user = await findUser(transaction, { discordUserId: interaction.user.id }, true);
				if (user == null) {
					await interaction.editReply(`You are not in a team`);
					return;
				}
				// fail if team with same name exists
				if (await findTeam(transaction, { name }) != null) {
					await interaction.editReply(`Another team called ${name} exists`);
					return;
				}
				// fail if doesnt have a previous team
				if (user.teamId == null) {
					await interaction.editReply(`You are not in a team`);
					return;
				}
				// rename previous team
				const team = await fetchTeam(transaction, user.teamId, true);
				await renameTeam(interaction.guild, transaction, team, name);
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Renamed team to ${name}`);
				return;
			}
		}

		if (interaction.commandName === "leaderboard") {
			const type = interaction.options.getString("type") || "normal";
			await interaction.editReply("haha lol leaderboard");
			return;
		}

		if (interaction.commandName === "points") {
			const subcommandName = interaction.options.getSubcommand(true);
			if (subcommandName === "give-team") {
				const name = interaction.options.getString("name", true);
				const points = interaction.options.getInteger("points", true);
				await interaction.editReply(`haha lol points give-team ${name} ${points}`);
				return;
			}
			if (subcommandName === "give-voice") {
				const channel = interaction.options.getString("channel", true);
				const points = interaction.options.getInteger("points", true);
				await interaction.editReply(`haha lol points give-voice ${channel} ${points}`);
				return;
			}
		}

	} catch (e) {
		console.error(e);
		try {
			await interaction.editReply(`Oops, an internal error occurred: ${e}`);
		} catch (e) {}
	}
});

client.login(process.env.BOT_TOKEN);
