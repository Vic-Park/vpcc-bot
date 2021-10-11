// Runs the VPCC-Bot

require("dotenv").config();

const NodeCache = require("node-cache");
const Keyv = require("keyv");
const { KeyvFile } = require("keyv-file");
const { Client, Intents, CategoryChannel, Permissions, User, MessageActionRow, MessageButton } = require("discord.js");
const client = new Client({ intents: [ Intents.FLAGS.GUILDS ], rejectOnRateLimit: () => true });

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
});

// keyv-file based store (will be upgraded to use replit's built in key value store later)
function createStore(keyv) {
	return {
		keyv,
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
}
const store = createStore(new Keyv({
	store: new KeyvFile({
		filename: "store.json",
	}),
}));

// Helper function to remove an element from an array
function removeFromArray(array, element) {
	const index = array.lastIndexOf(element);
	if (index !== -1)
		array.splice(index, 1);
	return array;
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
resourceSymbol = Symbol("resource")
function createResources(store) {
	return {
		store,
		cache: new NodeCache({ useClones: false }),
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
			obj[resourceSymbol] = options.resource;
			return obj;
		},
		// update the resource object to the store
		push: async function(obj) {
			const resource = obj[resourceSymbol];
			this.cache.del(resource);
			return await this.store.set(resource, obj);
		},
		// invalidate the cache
		invalidate: async function() {
			this.cache.flushAll();
		},
	};
}
const resources = createResources(store);

// creates a "transaction" that updates all changed values at the end
function createTransaction(resources) {
	return {
		resources,
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

// get users info
async function fetchUsers(resources) {
	const users = await resources.fetch(`/users`);
	users.userIds ??= [];
	return users;
}

// get teams info
async function fetchTeams(resources) {
	const teams = await resources.fetch(`/teams`);
	teams.teamIds ??= [];
	return teams;
}

// find user with matching requirements
async function findUser(resources, requirements) {
	users:
	for (const userId of (await fetchUsers(resources)).userIds) {
		let user = await fetchUser(resources, userId);
		for (const name in requirements)
			if (requirements[name] !== user[name])
				continue users;
		return user;
	}
	return undefined;
}

// find team with matching requirements
async function findTeam(resources, requirements) {
	teams:
	for (const teamId of (await fetchTeams(resources)).teamIds) {
		let team = await fetchTeam(resources, teamId);
		for (const name in requirements)
			if (requirements[name] !== team[name])
				continue teams;
		return team;
	}
	return undefined;
}

// find user with id
async function fetchUser(resources, userId) {
	const user = await resources.fetch(`/user/${userId}`);
	user.id ??= userId;
	return user;
}

// find teamId with id
async function fetchTeam(resources, teamId) {
	const team = await resources.fetch(`/team/${teamId}`);
	team.id ??= teamId;
	return team;
}

async function createUser(_guild, transaction, { id, ...properties }) {
	const users = await fetchUsers(transaction);
	const user = await fetchUser(transaction, id);
	// create user with properties
	Object.assign(user, properties);
	(users.userIds ??= []).push(user.id);
	return user;
}

async function createTeam(guild, transaction, { id, ...properties }) {
	const teams = await fetchTeams(transaction);
	const team = await fetchTeam(transaction, id);
	// create team with properties
	Object.assign(team, properties);
	(teams.teamIds ??= []).push(team.id);
	// create team role
	const role = await guild.roles.create({ name: `Team ${team.name}` });
	team.discordRoleId = role.id;
	// get supervisor role
	const supervisorRole = (await guild.roles.fetch()).find(role => role.name.toLowerCase() === "supervisor")
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
	if (supervisorRole != null) {
		channelOptions.permissionOverwrites.push(
			{ id: supervisorRole, allow: [ Permissions.FLAGS.VIEW_CHANNEL ] },
		);
	} else {
		console.log("sus no supervisor role");
	}
	const textChannel = await guild.channels.create(`Team ${team.name}`, channelOptions);
	const voiceChannel = await guild.channels.create(`Team ${team.name}`, { type: "GUILD_VOICE", ...channelOptions });
	team.discordTextChannelId = textChannel.id;
	team.discordVoiceChannelId = voiceChannel.id;
	return team;
}

async function joinTeam(guild, _transaction, team, user) {
	// join team
	(team.memberIds ??= []).push(user.id);
	user.teamId = team.id;
	// join team role
	const discordMember = await guild.members.fetch(user.discordUserId);
	await discordMember.roles.add(team.discordRoleId);
}

async function renameTeam(guild, _transaction, team, name) {
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

async function leaveTeam(guild, transaction, user) {
	const team = await fetchTeam(transaction, user.teamId);
	team.id ??= user.teamId;
	// leave team role
	const discordMember = await guild.members.fetch(user.discordUserId);
	await discordMember.roles.remove(team.discordRoleId);
	// leave team
	removeFromArray((team.memberIds ??= []), user.id);
	user.teamId = undefined;
}

async function destroyTeam(guild, transaction, team) {
	const teams = await fetchTeams(transaction);
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

setInterval(async () => {
	const guild = await client.guilds.fetch(process.env.GUILD_ID);
	console.log("running check on joinRandom")
	const transaction = createTransaction(resources);
	// check if joinRandom info is past 30 minutes
	const joinRandomInfo = await transaction.fetch(`/joinRandom`);
	if (joinRandomInfo.start <= Date.now() + 30 * 60_000)
		return;
	console.log("attempting to add user")
	// loop through all teams and get a free to join team with the smallest team size
	let bestTeam = undefined;
	for (const teamId of (await fetchTeams(transaction)).teamIds ?? []) {
		const team = await fetchTeam(transaction, teamId);
		if (!team.freeToJoin) continue;
		if (team.memberIds.length >= 4) continue;
		if (!bestTeam ? true : team.memberIds.length < bestTeam.memberIds.length) {
			bestTeam = team;
		}
	}
	const caller = await fetchUser(joinRandomInfo.caller);
	// if there's no team available, dm the user with sad face
	if (bestTeam == null) {
		(await (await guild.channels.fetch(joinRandomInfo.discordChannelId)).messages.fetch(joinRandomInfo.discordMessageId)).delete();
		removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
		clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
		clearObject(joinRandomInfo);
		await transaction.commit();
		await (await (await guild.members.fetch(caller.discordUserId)).createDM()).send("30 minutes passed but no free to join teams were available :(")
		return;
	}
	// join the team and clear info
	await joinTeam(guild, transaction, bestTeam, caller);
	const channel = await guild.channels.fetch(joinRandomInfo.discordChannelId);
	(await channel.messages.fetch(joinRandomInfo.discordMessageId)).delete();
	removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
	clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
	clearObject(joinRandomInfo);
	await transaction.commit();
	await channel.send(`${await guild.fetch(caller.discordUserId)} joined team ${bestTeam.name}`);
}, 60_000)

const teamFunctions = {
	async create(interaction, metadata) {
		const teamName = interaction.options.getString("team-name", true);
		const member1 = interaction.options.getMember("member1", true);
		const member2 = interaction.options.getMember("member2");
		const member3 = interaction.options.getMember("member3");
		const teamMates = [member1];
		if (member2 != null)
			teamMates.push(member2);
		if (member3 != null)
			teamMates.push(member3);
		// log command and setup transaction
		console.log([ "team2", "create", teamName, members, metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// fail if another team with same name exists
		if (await findTeam(transaction, { name: teamName }) != null) {
			await interaction.editReply(`Team called ${teamName} already exists`);
			return;
		}
		// fail if name is longer than 32 characters
		if (!(teamName.length <= 32)) {
			await interaction.editReply(`Team name ${teamName} too long`);
			return;
		}
		// fail if caller was specified
		if (teamMates.some(member => caller.id === member.id)) {
			await interaction.editReply(`Caller was specified again as a team mate`);
			return;
		}
		// fail if team mates aren't unique
		if ((new Set(teamMates.map(member => member.id))).size !== teamMates.size) {
			await interaction.editReply(`A team mate was repeated in the command`);
			return;
		}
		// create caller and team mates
		for (const member of [caller, ...teamMate]) {
			if (await findUser(transaction, { discordUserId: member.id }) == null) {
				await createUser(interaction.guild, transaction, { id: `${interaction.id}${member.id}`, discordUserId: member.id })
			}
		}
		// fail if caller is already in a team
		if ((await findUser(transaction, { discordUserId: caller.id })).teamId != null) {
			await interaction.editReply(`You are still in a team`);
			return;
		}
		// fail if a team mate is already in a team
		for (const teamMate of teamMates) {
			if ((await findUser(transaction, { discordUserId: teamMate.id })).teamId != null) {
				await interaction.editReply(`A team mate is still in a team`);
				return;
			}
		}
		// create incomplete team
		const team = await createTeam(interaction.guild, transaction, {
			id: interaction.id,
			name: teamName,
			incomplete: true,
			waiting: await (async () => {
				const waiting = [];
				for (const teamMate of teamMates) {
					waiting.push((await findUser(transaction, { discordUserId: teamMate.id })).id);
				}
				return waiting;
			})(),
			accepted: [],
			declined: [],
			caller: (await findUser(transaction, { discordUserId: caller.id })).id,
		});
		// create delayed interaction info
		const message = await interaction.fetchReply();
		((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
		const info = await transaction.fetch(`/interaction/${message.id}`);
		Object.assign(info, {
			id: message.id,
			type: "teamCreate",
			teamId: team.id,
		});
		// join team
		await joinTeam(interaction.guild, transaction, team, await findUser(transaction, { discordUserId: caller.id }));
		// for (const teamMate of teamMates) {
		// 	await joinTeam(interaction.guild, transaction, team, await findUser(transaction, { discordUserId: teamMate.id }));
		// }
		// Created and joined new team called ${teamName}
		// complete command and commit transaction
		await transaction.commit();
		// create message that has buttons for confirming stuff
		await interaction.editReply({
			content: `Awaiting confirmation from ${teamMates.map(teamMate => teamMate.toString()).join(", ")} to create new team called ${teamName}`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("accept")
						.setLabel("Accept")
						.setStyle("PRIMARY"),
					new MessageButton()
						.setCustomId("decline")
						.setLabel("Decline")
						.setStyle("DANGER"),
					new MessageButton()
						.setCustomId("cancel")
						.setLabel("Cancel")
						.setStyle("SECONDARY"),
				),
			],
		});
	},
	async join(interaction, metadata) {
		const teamName = interaction.options.getString("team-name", true);
		// log command and setup transaction
		console.log([ "team2", "join", teamName, metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// fail if team with name doesnt exists
		const team = await findTeam(transaction, { name: teamName });
		if (team == null || team.incomplete) {
			await interaction.editReply(`Team called ${teamName} doesn't exists`);
			return;
		}
		// create caller
		if (await findUser(transaction, { discordUserId: caller.id }) == null) {
			await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
		}
		// fail if caller is already in a team
		if ((await findUser(transaction, { discordUserId: caller.id })).teamId != null) {
			await interaction.editReply(`You are still in a team`);
			return;
		}
		// confirm with caller
		await interaction.editReply({
			content: `Just to confirm, are you attempting to join team ${team.name} with members ${await (async () => {
				const names = [];
				for (const memberId of team.memberIds) {
					names.push((await interaction.guild.members.fetch((await fetchUser(memberId)).discordUserId)).nickname);
				};
				return names.join(", ");
			})()}?`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("yes")
						.setLabel("Confirm")
						.setStyle("PRIMARY"),
					new MessageButton()
						.setCustomId("no")
						.setLabel("Cancel")
						.setStyle("DANGER"),
				),
			],
		});
		// using awaitMessageComponent here because confirming stuff after more then 15 mins is sus
		const nextInteraction = (await interaction.fetchReply()).awaitMessageComponent({
			filter: interaction => interaction.user.id === caller.id,
			time: 10_000,
		})
		if (nextInteraction == null) {
			await interaction.editReply(`Confirmation timed out`);
			return;
		}
		if (nextInteraction.customId === "no") {
			await interaction.editReply(`Cancelled join request`);
			return;
		}
		// fail if team is full
		if (team.memberIds.length >= 4) {
			await interaction.editReply(`Requested team is full`);
			return;
		}
		// create delayed interaction info
		const message = await interaction.fetchReply();
		((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
		const info = await transaction.fetch(`/interaction/${message.id}`);
		Object.assign(info, {
			id: message.id,
			type: "teamJoin",
			teamId: team.id,
			waiting: [...team.memberIds],
			approved: [],
			rejected: [],
			caller: (await findUser(transaction, { discordUserId: caller.id })).id,
		});
		// complete command and commit transaction
		await transaction.commit();
		// create message that has buttons for confirming stuff
		await interaction.editReply({
			content: `Awaiting approval from team ${teamName} with members ${teamMates.map(teamMate => teamMate.toString()).join(", ")} to approve ${caller} joining`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("approve")
						.setLabel("Approve")
						.setStyle("PRIMARY"),
					new MessageButton()
						.setCustomId("reject")
						.setLabel("Reject")
						.setStyle("DANGER"),
					new MessageButton()
						.setCustomId("cancel")
						.setLabel("Cancel")
						.setStyle("SECONDARY"),
				),
			],
		});
	},
	async rename(interaction, metadata) {
		const newTeamName = interaction.options.getString("new-team-name", true);
		// log command and setup transaction
		console.log([ "team2", "rename", newTeamName, metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// create caller
		let callerUser = await findUser(transaction, { discordUserId: caller.id });
		if (callerUser == null) {
			callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
		}
		// fail if caller isn't in a team
		if ((await findUser(transaction, { discordUserId: caller.id })).teamId == null) {
			await interaction.editReply(`You are not in a team`);
			return;
		}
		// fail if name is longer than 32 characters
		if (!(newTeamName.length <= 32)) {
			await interaction.editReply(`Team name ${newTeamName} too long`);
			return;
		}
		// fail if another team with same name exists
		if (await findTeam(transaction, { name: newTeamName }) != null) {
			await interaction.editReply(`Team called ${newTeamName} already exists`);
			return;
		}
		// create delayed interaction info
		const message = await interaction.fetchReply();
		((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
		const info = await transaction.fetch(`/interaction/${message.id}`);
		Object.assign(info, {
			id: message.id,
			type: "teamRename",
			teamId: team.id,
			waiting: removeFromArray([...team.memberIds], callerUser.id),
			approved: [callerUser.id],
			rejected: [],
			caller: callerUser.id,
			newTeamName,
		});
		// complete command and commit transaction
		await transaction.commit();
		// create message that has buttons for confirming stuff
		await interaction.editReply({
			content: `Awaiting approval from team members ${teamMates.map(teamMate => teamMate.toString()).join(", ")} to approve renaming team to ${newTeamName}`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("approve")
						.setLabel("Approve")
						.setStyle("PRIMARY"),
					new MessageButton()
						.setCustomId("reject")
						.setLabel("Reject")
						.setStyle("DANGER"),
					new MessageButton()
						.setCustomId("cancel")
						.setLabel("Cancel")
						.setStyle("SECONDARY"),
				),
			],
		});
	},
	async leave(interaction, metadata) {
		const newTeamName = interaction.options.getString("new-team-name", true);
		// log command and setup transaction
		console.log([ "team2", "leave", metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// create caller
		let callerUser = await findUser(transaction, { discordUserId: caller.id });
		if (callerUser == null) {
			callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
		}
		// fail if caller isn't in a team
		if ((await findUser(transaction, { discordUserId: caller.id })).teamId == null) {
			await interaction.editReply(`You are not in a team`);
			return;
		}
		// complete command and commit transaction
		await transaction.commit();
		// create message with further instructions for leaving a team
		await interaction.editReply([
			"Hello! It seems you want to leave your team. ",
			"There are many risks with leaving a team, such as",
			"not being able to join back, no points being awarded to you after this month, and more.",
			"If you understand these risks and still wish to continue,",
			"please DM a leader for further action. Thanks :D",
		].join(" "));
	},
	"join-random": async (interaction, metadata) => {
		// log command and setup transaction
		console.log([ "team2", "join-random", metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// create caller
		let callerUser = await findUser(transaction, { discordUserId: caller.id });
		if (callerUser == null) {
			callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
		}
		// fail if caller is in a team
		if ((await findUser(transaction, { discordUserId: caller.id })).teamId != null) {
			await interaction.editReply(`You are already in a team`);
			return;
		}
		// get joinRandom info
		const message = await interaction.fetchReply();
		const joinRandomInfo = await transaction.fetch(`/joinRandom`);
		// if there's another person tryna join a team
		if ("start" in joinRandomInfo) {
			// generate a random team name that doesn't exist
			const teamName = `${Math.floor(Math.random() * 2000)}`
			if (await findTeam(transaction, { name: teamName }) != null)
				throw Error("lol just try again pls: team name collided");
			// make a team with them and have it be open to others
			const otherUser = await fetchUser(transaction, joinRandomInfo.caller);
			const team = await createTeam(interaction.guild, transaction, { id: interaction.id, name: teamName, freeToJoin: true });
			await joinTeam(interaction.guild, transaction, team, otherUser);
			await joinTeam(interaction.guild, transaction, team, callerUser);
			// remove previous message and clear info
			(await (await interaction.guild.channels.fetch(joinRandomInfo.discordChannelId)).messages.fetch(joinRandomInfo.discordMessageId)).delete();
			removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
			clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
			clearObject(joinRandomInfo);
			// complete command
			await transaction.commit();
			await interaction.editReply(`Team ${team.name} with members ${await interaction.guild.members.fetch(callerUser.discordUserId)} and ${await interaction.guild.members.fetch(otherUser.discordUserId)} is created`);
			return;
		}
		// create delayed interaction info
		const message = await interaction.fetchReply();
		((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
		const info = await transaction.fetch(`/interaction/${message.id}`);
		Object.assign(info, {
			id: message.id,
			type: "teamJoinRandom",
			caller: callerUser.id,
		});
		// update joinRandom info
		Object.assign(joinRandomInfo, {
			caller: callerUser.id,
			start: Date.now(),
			discordChannelId: message.channel.id,
			discordMessageId: message.id,
			interactionId: message.id,
		});
		// complete command and commit transaction
		await transaction.commit();
		await interaction.editReply({
			content: `${caller} is looking for a team! DM them if you want to team up!`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("cancel")
						.setLabel("Cancel")
						.setStyle("SECONDARY"),
				),
			],
		});
		await (await (await caller.fetch()).createDM()).send("If you aren't in a team after 30 minutes and haven't cancelled, I'll automatically place you in a team :D");
	},
};

// accept: ✅
// deny: ❌
// cancel: 🗑️

/*
const filter = (reaction, user) => reaction.emoji.name === '👍' && user.id === message.author.id;
const reactions = await message.awaitReactions({ filter, max: 1, time: 60_000 });
*/

// Process button interactions
client.on("interactionCreate", async interaction => {
	if (!interaction.isButton())
		return;
	await interaction.deferUpdate();
	console.log({
		timestamp: Date.now(),
		userDisplayName: `${interaction.user.username}#${interaction.user.discriminator}`,
		userId: interaction.user.id,
		interaction,
	});
	try {
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		if (!((await transaction.fetch(`/interactions`)).interactionIds ?? []).includes(interaction.message.id)) {
			// await interaction.editReply(`Could not find interaction to continue`);
			console.log("unknown interaction");
			return;
		}
		const info = await transaction.fetch(`/interaction/${interaction.message.id}`);
		if (info.type === "teamCreate") {
			const team = await fetchTeam(transaction, info.teamId);
			const callerUser = await findUser(transaction, { discordUserId: caller.id });
			if (interaction.customId === "accept") {
				if (team.caller === callerUser.id) {
					await interaction.editReply(`Caller cannot accept own invitation`);
					return;
				} else if (team.accepted.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot accept invitation again`);
					return;
				} else if (team.declined.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot accept invitation after declining`);
					return;
				} else if (!team.waiting.includes(callerUser.id)) {
					await interaction.editReply(`Caller wasn't invited`);
					return;
				}
				removeFromArray(team.waiting, callerUser.id);
				team.accepted.push(callerUser.id);
				await joinTeam(interaction.guild, transaction, team, callerUser);
				if (team.accepted.length >= 1) {
					for (const waiting of team.waiting) {
						await joinTeam(interaction.guild, transaction, team, await fetchUser(waiting.id));
					}
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					delete team.waiting;
					delete team.accepted;
					delete team.declined;
					delete team.caller;
					team.incomplete = false;
					await transaction.commit();
					await interaction.editReply(`Team ${team.name} with members ${await (async () => {
						const names = [];
						for (const memberId of team.memberIds) {
							names.push((await interaction.guild.members.fetch((await fetchUser(memberId)).discordUserId)).toString());
						};
						return names.join(", ");
					})()} is created`);
					return;
				}
				await transaction.commit();
				await interaction.editReply(`Accepted invitation to ${team.name}`);
				return;
			}
			if (interaction.customId === "decline") {
				if (team.caller === callerUser.id) {
					await interaction.editReply(`Caller cannot decline own invitation`);
					return;
				} else if (team.declined.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot decline invitation again`);
					return;
				} else if (team.accepted.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot decline invitation after accepting`);
					return;
				} else if (!team.waiting.includes(callerUser.id)) {
					await interaction.editReply(`Caller wasn't invited`);
					return;
				}
				removeFromArray(team.waiting, callerUser.id);
				team.declined.push(callerUser.id);
				if (team.waiting.length == 0) {
					for (const accepted of [team.caller, ...team.accepted]) {
						await leaveTeam(interaction.guild, transaction, await fetchUser(accepted.id));
					}
					await destroyTeam(interaction.guild, transaction, team);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					delete team.waiting;
					delete team.accepted;
					delete team.declined;
					delete team.caller;
					await transaction.commit();
					await interaction.editReply(`Team ${team.name} will not be created`);
					return;
				}
				await transaction.commit();
				await interaction.editReply(`Declined invitation to ${team.name}`);
				return;
			}
			if (interaction.customId === "cancel") {
				if (team.caller !== callerUser.id) {
					await interaction.editReply(`Caller isn't inviter`);
					return;
				}
				for (const accepted of [team.caller, ...team.accepted]) {
					await leaveTeam(interaction.guild, transaction, await fetchUser(accepted.id));
				}
				await destroyTeam(interaction.guild, transaction, team);
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await interaction.editReply(`Team ${team.name} cancelled`);
				return;
			}
			/*
			waiting: await (async () => {
				const waiting = [];
				for (const teamMate of teamMates) {
					waiting.push((await findUser(transaction, { discordUserId: teamMate.id })).id);
				}
				return waiting;
			})(),
			accepted: [],
			declined: [],
			caller: (await findUser(transaction, { discordUserId: caller.id })).id,
			*/
		}
		if (info.type === "teamJoin") {
			const team = await fetchTeam(transaction, info.teamId);
			const numMembers = info.waiting.length + info.approved.length + info.declined.length;
			const callerUser = await findUser(transaction, { discordUserId: caller.id });
			if (interaction.customId === "approve") {
				if (info.approved.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot approve join request again`);
					return;
				} else if (info.rejected.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot approve join request after rejecting`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await interaction.editReply(`Caller not in team`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.approved.push(callerUser.id);
				if (info.approved.length > numMembers / 2) {
					// fail if team is full
					if (info.memberIds.length >= 4) {
						await transaction.commit();
						await interaction.editReply(`${await interaction.guild.fetch((await fetchUser(transaction, info.caller)).discordUserId)}'s requested team is now full`);
						return;
					}
					await joinTeam(interaction.guild, transaction, team, callerUser);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await interaction.editReply(`${await interaction.guild.fetch((await fetchUser(transaction, info.caller)).discordUserId)} joined team ${team.name}`);
					return;
				}
				await transaction.commit();
				await interaction.editReply(`Approved request from ${(await interaction.guild.fetch((await fetchUser(transaction, info.caller)).discordUserId)).nickname} to ${team.name}`);
				return;
			}
			if (interaction.customId === "reject") {
				if (info.rejected.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot reject join request again`);
					return;
				} else if (info.approved.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot reject join request after approving`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await interaction.editReply(`Caller not in team`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.rejected.push(callerUser.id);
				if (info.rejected.length > numMembers / 2) {
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await interaction.editReply(`Rejected ${await interaction.guild.fetch((await fetchUser(transaction, info.caller)).discordUserId)}'s request to join team ${team.name}`);
					return;
				}
				await transaction.commit();
				await interaction.editReply(`Rejected request from ${(await interaction.guild.fetch((await fetchUser(transaction, info.caller)).discordUserId)).nickname} to ${team.name}`);
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					await interaction.editReply(`Caller isn't join requester`);
					return;
				}
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await interaction.editReply(`Request to join ${team.name} was cancelled`);
				return;
			}
		}
		if (info.type === "teamRename") {
			const team = await fetchTeam(transaction, info.teamId);
			const numMembers = info.waiting.length + info.approved.length + info.declined.length;
			const callerUser = await findUser(transaction, { discordUserId: caller.id });
			if (interaction.customId === "approve") {
				if (info.caller === callerUser.id) {
					await interaction.editReply(`Caller cannot approve own rename request`);
					return;
				} else if (info.approved.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot approve rename request again`);
					return;
				} else if (info.rejected.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot approve rename request after rejecting`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await interaction.editReply(`Caller not in team`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.approved.push(callerUser.id);
				if (info.approved.length > numMembers / 2) {
					const oldTeamName = team.name;
					// fail if another team with same name exists
					if (await findTeam(transaction, { name: info.newTeamName }) != null) {
						await transaction.commit();
						await interaction.editReply(`Team called ${info.newTeamName} now exists`);
						return;
					}
					await renameTeam(interaction.guild, transaction, team, info.newTeamName);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await interaction.editReply(`Renamed team ${oldTeamName} to ${team.name}`);
					return;
				}
				await transaction.commit();
				await interaction.editReply(`Approved rename request from ${team.name} to ${info.newTeamName}`);
				return;
			}
			if (interaction.customId === "reject") {
				if (info.caller === callerUser.id) {
					await interaction.editReply(`Caller cannot reject own rename request`);
					return;
				} else if (info.rejected.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot reject rename request again`);
					return;
				} else if (info.approved.includes(callerUser.id)) {
					await interaction.editReply(`Caller cannot reject rename request after approving`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await interaction.editReply(`Caller not in team`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.rejected.push(callerUser.id);
				if (info.rejected.length > numMembers / 2) {
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await interaction.editReply(`Request to rename team ${team.name} to ${info.newTeamName} is rejected`);
					return;
				}
				await transaction.commit();
				await interaction.editReply(`Rejected rename request from ${team.name} to ${info.newTeamName}`);
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					await interaction.editReply(`Caller isn't rename requester`);
					return;
				}
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await interaction.editReply(`Request to rename team ${team.name} to ${info.newTeamName} is cancelled`);
				return;
			}
		}
		if (info.type === "teamJoinRandom") {
			const callerUser = await findUser(transaction, { discordUserId: caller.id });
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					await interaction.editReply(`Caller isn't join random requester`);
					return;
				}
				// remove interaction info and joinRandom info
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				const joinRandomInfo = await transaction.fetch(`/joinRandom`);
				(await (await interaction.guild.channels.fetch(joinRandomInfo.discordChannelId)).messages.fetch(joinRandomInfo.discordMessageId)).delete();
				clearObject(joinRandomInfo);
				// complete command
				await transaction.commit();
				await interaction.editReply(`Cancelled join random request`);
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
				let result = await transaction.fetch(resource.trim());
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
			if (subcommandName === "remove-from-team") {
				const teamName = interaction.options.getString("team-name", true);
				const member = interaction.options.getMember("member", true);
				console.log([ "admin", "remove-from-team", teamName, member, metadata ]);
				const transaction = createTransaction(resources);
				// fail if user doesnt exist
				const user = await findUser(transaction, { discordUserId: member.id });
				if (user == null) {
					await interaction.editReply(`User is not in a team`);
					return;
				}
				// fail if doesnt have a previous team
				if (user.teamId == null) {
					await interaction.editReply(`User is not in a team`);
					return;
				}
				// get team name
				const team = await fetchTeam(transaction, user.teamId);
				const teamName = team.name;
				// leave previous team
				await leaveTeam(interaction.guild, transaction, user);
				// remove team if empty
				// if ((team.memberIds ?? []).length === 0) {
				// 	await destroyTeam(interaction.guild, transaction, team);
				// }
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Removed ${member} from team ${teamName}`);
				return;
			}
			if (subcommandName === "delete-team") {
				const teamName = interaction.options.getString("team-name", true);
				console.log([ "admin", "delete-team", teamName, metadata ]);
				const transaction = createTransaction(resources);
				// fail if team doesnt exist
				const team = await findTeam(transaction, { name: teamName });
				const teamName = team.name;
				if (team == null) {
					await interaction.editReply(`Team does not exist`);
					return;
				}
				// confirmation with a list of ppl in the team
				await interaction.editReply({
					content: `Just to confirm, are you attempting to destroy team ${team.name} with members ${await (async () => {
						const names = [];
						for (const memberId of team.memberIds) {
							names.push((await interaction.guild.members.fetch((await fetchUser(memberId)).discordUserId)).nickname);
						};
						return names.join(", ");
					})()}?`,
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId("yes")
								.setLabel("Confirm")
								.setStyle("PRIMARY"),
							new MessageButton()
								.setCustomId("no")
								.setLabel("Cancel")
								.setStyle("DANGER"),
						),
					],
				});
				// using awaitMessageComponent here because confirming stuff after more then 15 mins is sus
				const nextInteraction = (await interaction.fetchReply()).awaitMessageComponent({
					filter: interaction => interaction.user.id === caller.id,
					time: 10_000,
				})
				if (nextInteraction == null) {
					await interaction.editReply(`Confirmation timed out`);
					return;
				}
				if (nextInteraction.customId === "no") {
					await interaction.editReply(`Cancelled team destruction`);
					return;
				}
				// destroy team
				for (const memberId of team.memberIds) {
					await leaveTeam(interaction.guild, transaction, await fetchUser(transaction, memberId));
				}
				await destroyTeam(interaction.guild, transaction, team);
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Destroyed team ${teamName}`);
				return;
			}
			if (subcommandName === "rename-team") {
				const teamName = interaction.options.getString("team-name", true);
				const newTeamName = interaction.options.getString("new-team-name", true);
				console.log([ "admin", "rename-team", teamName, newTeamName, metadata ]);
				const transaction = createTransaction(resources);
				// fail if team doesnt exist
				const team = await findTeam(transaction, { name: teamName });
				const teamName = team.name;
				if (team == null) {
					await interaction.editReply(`Team does not exist`);
					return;
				}
				// rename team
				await renameTeam(interaction.guild, transaction, team, newTeamName);
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Renamed ${teamName} to ${newTeamName}`);
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
				let user = await findUser(transaction, { discordUserId: interaction.user.id });
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
				let user = await findUser(transaction, { discordUserId: interaction.user.id });
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
				const team = await findTeam(transaction, { name });
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
				const user = await findUser(transaction, { discordUserId: interaction.user.id });
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
				const team = await fetchTeam(transaction, user.teamId);
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
				const user = await findUser(transaction, { discordUserId: interaction.user.id });
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
				const team = await fetchTeam(transaction, user.teamId);
				await renameTeam(interaction.guild, transaction, team, name);
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Renamed team to ${name}`);
				return;
			}
		}

		if (interaction.commandName === "team2") {
			const subcommandName = interaction.options.getSubcommand(true);
			if (subcommandName in teamFunctions) {
				await teamFunctions[subcommandName](interaction, metadata);
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

		// fallback when command aint implemented
		await interaction.editReply("not implemented yet lol");

	} catch (e) {
		console.error(e);
		try {
			await interaction.editReply(`Oops, an internal error occurred: ${e}`);
		} catch (e) {}
	}
});

client.login(process.env.BOT_TOKEN);
