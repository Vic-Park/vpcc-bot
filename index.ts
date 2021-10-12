// Runs the VPCC-Bot

import NodeCache from "node-cache";
import Keyv from "keyv";
import { KeyvFile } from "keyv-file";
import { CategoryChannel, Client, CommandInteraction, Guild, GuildChannel, Intents, Interaction, MessageActionRow, MessageButton, Permissions, Role, TextChannel, User, VoiceChannel } from "discord.js";
import _assert from "assert";

require("dotenv").config();

const client = new Client({ intents: [ Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS ], rejectOnRateLimit: () => true });

client.on("ready", () => {
	console.log(`Logged in as ${client.user!.tag}`);
});

function sleep(milliseconds: number) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function assert<T>(thing: T): asserts thing is NonNullable<T> {
	_assert(thing != null);
}

// keyv-file based store (will be upgraded to use replit's built in key value store later)
class Store {
	keyv: Keyv<Object>;
	constructor(keyv: Keyv<Object>) {
		this.keyv = keyv;
	};
	async get(resource: string): Promise<Object> {
		return (await this.keyv.get(resource)) ?? {};
	};
	async set(resource: string, data: Object): Promise<void> {
		if (JSON.stringify(data) === "{}")
			await this.keyv.delete(resource);
		else
			await this.keyv.set(resource, data);
	};
	async modify(resource: string, callback: (data: Object) => any): Promise<void> {
		const data = await this.get(resource);
		await callback(data);
		await this.set(resource, data);
	};
}
function createStore(keyv: Keyv<Object>): Store {
	return new Store(keyv);
}
const store = createStore(new Keyv({
	store: new KeyvFile({
		filename: "store.json",
	}),
}) as Keyv<Object>);

// Helper function to remove an element from an array
function removeFromArray<T>(array: T[], element: T): typeof array {
	const index = array.lastIndexOf(element);
	if (index !== -1)
		array.splice(index, 1);
	return array;
}

// Asynchronous version of Array.prototype.find
async function findPredicate<T>(array: T[], predicate: (v: T, i: number, a: typeof array) => Promise<boolean>): Promise<T | undefined> {
	for (let i = 0; i < array.length; i++) {
		if (await predicate(array[i], i, array)) {
			return array[i];
		}
	}
	return undefined;
}

// - VPCC specific helper functions

// global cache object
type ResourceFetchOptions = string | { force?: boolean; resource: string; cache?: boolean };
class Resources {
	store: Store;
	cache: NodeCache;
	resourceCache: WeakMap<object, string>;
	constructor(store: Store) {
		this.store = store;
		this.cache = new NodeCache();
		this.resourceCache = new WeakMap();
	};
	// call with a resource string or an object with { resource, force = false, cache = true }
	async fetch(options: ResourceFetchOptions): Promise<Record<string, any>> {
		if (typeof options === "string")
			options = { resource: options };
		let obj: Record<string, any> | null | undefined = undefined;
		if (!(options.force ?? false))
			obj = this.cache.get(options.resource);
		if (obj == null) {
			obj = await this.store.get(options.resource);
			if (options.cache ?? true)
				this.cache.set(options.resource, obj);
		}
		this.resourceCache.set(obj, options.resource);
		return obj;
	};
	// update the resource object to the store
	async push(obj: Record<string, any>) {
		const resource = this.resourceCache.get(obj);
		if (resource == null) return;
		this.cache.del(resource);
		return await this.store.set(resource, obj);
	};
	// invalidate the cache
	async invalidate() {
		this.cache.flushAll();
	};
}
function createResources(store: Store): Resources {
	return new Resources(store);
}
const resources = createResources(store);

// creates a "transaction" that updates all changed values at the end
class Transaction {
	resources: Resources;
	data: Record<string, any>;
	constructor(resources: Resources) {
		this.resources = resources;
		this.data = {};
	};
	// call with a resource string or an object with resources.fetch.options
	async fetch(options: ResourceFetchOptions): Promise<Record<string, any>> {
		if (typeof options === "string")
			options = { resource: options };
		return this.data[options.resource] ??= await this.resources.fetch(options);
	};
	// pushes all changes and clears data
	async commit(): Promise<void> {
		for (const resource in this.data) {
			// future: check if something actually changed before pushing
			await this.resources.push(this.data[resource]);
			delete this.data[resource];
		}
	};
}
function createTransaction(resources: Resources) {
	return new Transaction(resources);
}

let running = false;

// fetchable type
type Fetchable = Transaction | Resources;

// deletes all values from an object
function clearObject(obj: Record<string, any>) {
	for (const name in obj)
		delete obj[name];
}

type TeamsData = {
	teamIds: TeamData["id"][],
}

type UsersData = {
	userIds: UserData["id"][],
}

type TeamData = {
	id: string,
	name: string,
	memberIds: string[],
	discordRoleId: string,
	discordTextChannelId: string,
	discordVoiceChannelId: string,
	freeToJoin?: boolean,
	pointEvents?: Record<string, any>,
}

type UserData = {
	id: string,
	teamId?: string,
	discordUserId: string,
}

// get users info
async function fetchUsers(resources: Fetchable): Promise<UsersData> {
	const users = await resources.fetch(`/users`);
	users.userIds ??= [];
	return users as UsersData;
}

// get teams info
async function fetchTeams(resources: Fetchable): Promise<TeamsData> {
	const teams = await resources.fetch(`/teams`);
	teams.teamIds ??= [];
	return teams as TeamsData;
}

// Typed Object.keys
function* objectKeys<T>(thing: T): Generator<keyof T> {
	for (const name in thing) {
		yield name as keyof T;
	}
}

// find user with matching requirements
async function findUser(resources: Fetchable, requirements: Partial<UserData>) {
	users:
	for (const userId of (await fetchUsers(resources)).userIds) {
		let user = await fetchUser(resources, userId);
		for (const name of objectKeys(requirements))
			if (requirements[name] !== user[name])
				continue users;
		return user;
	}
	return undefined;
}

// find team with matching requirements
async function findTeam(resources: Fetchable, requirements: Partial<TeamData>) {
	teams:
	for (const teamId of (await fetchTeams(resources)).teamIds) {
		let team = await fetchTeam(resources, teamId);
		for (const name of objectKeys(requirements))
			if (requirements[name] !== team[name])
				continue teams;
		return team;
	}
	return undefined;
}

// find user with id
async function fetchUser(resources: Fetchable, userId: string): Promise<UserData> {
	const user = await resources.fetch(`/user/${userId}`);
	user.id ??= userId;
	return user as UserData;
}

// find teamId with id
async function fetchTeam(resources: Fetchable, teamId: string): Promise<TeamData> {
	const team = await resources.fetch(`/team/${teamId}`);
	team.id ??= teamId;
	return team as TeamData;
}

async function createUser(_guild: any, transaction: Fetchable, { id, ...properties }: UserData): Promise<UserData> {
	const users = await fetchUsers(transaction);
	const user = await fetchUser(transaction, id);
	// create user with properties
	Object.assign(user, properties);
	(users.userIds ??= []).push(user.id);
	return user;
}

async function createTeam(guild: Guild, transaction: Fetchable, { id, ...properties }: Omit<TeamData, "memberIds" | "discordRoleId" | "discordTextChannelId" | "discordVoiceChannelId">): Promise<TeamData> {
	const teams = await fetchTeams(transaction);
	const team = await fetchTeam(transaction, id);
	// create team with properties
	Object.assign(team, properties);
	(teams.teamIds ??= []).push(team.id);
	team.memberIds ??= [];
	// create team role
	const role = await guild.roles.create({ name: `Team ${team.name}` });
	team.discordRoleId = role.id;
	// get supervisor role
	const supervisorRole = (await guild.roles.fetch()).find((role: { name: string; }) => role.name.toLowerCase() === "supervisor")
	// create team text and voice channels
	const teamCategory = (await guild.channels.fetch()).find((channel: GuildChannel) => (
		channel instanceof CategoryChannel
		&& channel.name.toLowerCase() === "team"
	)) as CategoryChannel | undefined;
	if (teamCategory == null) {
		throw Error("team category not found");
	}
	const channelOptions = {
		parent: teamCategory,
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

async function joinTeam(guild: Guild, _transaction: Fetchable, team: TeamData, user: UserData) {
	// join team
	(team.memberIds ??= []).push(user.id);
	user.teamId = team.id;
	// join team role
	const discordMember = await guild.members.fetch(user.discordUserId);
	const role = await guild.roles.fetch(team.discordRoleId);
	assert(role);
	await discordMember.roles.add(role);
}

async function renameTeam(guild: Guild, _transaction: Fetchable, team: TeamData, name: string) {
	// rename team
	team.name = name;
	// rename team channels
	assert(team.discordTextChannelId);
	assert(team.discordVoiceChannelId);
	const textChannel = await guild.channels.fetch(team.discordTextChannelId);
	const voiceChannel = await guild.channels.fetch(team.discordVoiceChannelId);
	assert(textChannel);
	assert(voiceChannel);
	await textChannel.edit({ name: `Team ${name}` });
	await voiceChannel.edit({ name: `Team ${name}` });
	// rename role
	assert(team.discordRoleId);
	const role = await guild.roles.fetch(team.discordRoleId);
	assert(role);
	await role.edit({ name: `Team ${name}` });
}

async function leaveTeam(guild: Guild, transaction: Fetchable, user: UserData) {
	assert(user.teamId);
	const team = await fetchTeam(transaction, user.teamId);
	team.id ??= user.teamId;
	// leave team role
	const discordMember = await guild.members.fetch(user.discordUserId);
	assert(team.discordRoleId);
	const role = await guild.roles.fetch(team.discordRoleId);
	assert(role);
	await discordMember.roles.remove(role);
	// leave team
	removeFromArray((team.memberIds ??= []), user.id);
	user.teamId = undefined;
}

async function destroyTeam(guild: Guild, transaction: Fetchable, team: TeamData) {
	const teams = await fetchTeams(transaction);
	// remove team channels
	assert(team.discordTextChannelId);
	assert(team.discordVoiceChannelId);
	const textChannel = await guild.channels.fetch(team.discordTextChannelId);
	const voiceChannel = await guild.channels.fetch(team.discordVoiceChannelId);
	assert(textChannel);
	assert(voiceChannel);
	await textChannel.delete();
	await voiceChannel.delete();
	// remove team role
	assert(team.discordRoleId);
	const role = await guild.roles.fetch(team.discordRoleId);
	assert(role);
	await role.delete();
	// remove team
	removeFromArray((teams.teamIds ??= []), team.id);
	clearObject(team);
}

async function checkJoinRandom() {
	const guild = await client.guilds.fetch(process.env.GUILD_ID!);
	console.log("running check on joinRandom");
	const transaction = createTransaction(resources);
	// check if joinRandom info is past 30 minutes
	const joinRandomInfo = await transaction.fetch(`/joinRandom`);
	if (joinRandomInfo.start == null || joinRandomInfo.start + 30 * 60_000 > Date.now())
		return;
	console.log("attempting to add user");
	// ensure user still doesnt have a team
	const caller = await fetchUser(transaction, joinRandomInfo.caller);
	let bestTeam = undefined;
	if (caller.teamId == null) {
		// loop through all teams and get a free to join team with the smallest team size
		for (const teamId of (await fetchTeams(transaction)).teamIds ?? []) {
			const team = await fetchTeam(transaction, teamId);
			if (!team.freeToJoin) continue;
			if (team.memberIds.length >= 4) continue;
			if (!bestTeam ? true : team.memberIds.length < bestTeam.memberIds.length) {
				bestTeam = team;
			}
		}
		// if there's no team available, dm the user with sad face
		if (bestTeam == null) {
			(await (await guild.channels.fetch(joinRandomInfo.discordChannelId) as TextChannel).messages.fetch(joinRandomInfo.discordMessageId)).delete();
			removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
			clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
			clearObject(joinRandomInfo);
			await transaction.commit();
			await (await (await guild.members.fetch(caller.discordUserId)).createDM()).send("30 minutes passed but no free to join teams were available :(")
			return;
		}
		// join the team and clear info
		await joinTeam(guild, transaction, bestTeam, caller);
	}
	const channel = await guild.channels.fetch(joinRandomInfo.discordChannelId) as TextChannel;
	(await channel.messages.fetch(joinRandomInfo.discordMessageId)).delete();
	removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
	clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
	clearObject(joinRandomInfo);
	await transaction.commit();
	if (bestTeam != null) {
		await channel.send(`${await guild.members.fetch(caller.discordUserId)} joined team ${bestTeam.name}`);
	}
}

client.once("ready", async () => {
	while (true) {
		await Promise.all([
			checkJoinRandom(),
			sleep(60_000),
		]);
	}
});

const teamFunctions: Record<string, (i: CommandInteraction, m: any) => Promise<void>> = {
	async create(interaction: CommandInteraction, metadata: any) {
		assert(interaction.guild);
		assert(interaction.channel);
		const teamName = interaction.options.getString("team-name", true);
		const member1 = await interaction.guild.members.fetch(interaction.options.getUser("member1", true));
		const member2 = interaction.options.getUser("member2", false);
		const member3 = interaction.options.getUser("member3", false);
		const teamMates = [member1];
		if (member2 != null)
			teamMates.push(await interaction.guild.members.fetch(member2));
		if (member3 != null)
			teamMates.push(await interaction.guild.members.fetch(member3));
		// log command and setup transaction
		console.log([ "team", "create", teamName, teamMates, metadata ]);
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
		if ((new Set(teamMates.map(member => member.id))).size !== teamMates.length) {
			await interaction.editReply(`A team mate was repeated in the command`);
			return;
		}
		// create caller and team mates
		for (const member of [caller, ...teamMates]) {
			if (await findUser(transaction, { discordUserId: member.id }) == null) {
				await createUser(interaction.guild, transaction, { id: `${interaction.id}${member.id}`, discordUserId: member.id })
			}
		}
		// fail if caller is already in a team
		if ((await findUser(transaction, { discordUserId: caller.id }))!.teamId != null) {
			await interaction.editReply(`You are still in a team`);
			return;
		}
		// fail if a team mate is already in a team
		for (const teamMate of teamMates) {
			if ((await findUser(transaction, { discordUserId: teamMate.id }))!.teamId != null) {
				await interaction.editReply(`A team mate is still in a team`);
				return;
			}
		}
		// create delayed interaction info
		await interaction.editReply(".");
		const previousMessage = await interaction.fetchReply();
		const message = await (await interaction.channel.messages.fetch(previousMessage.id)).reply(".");
		// const message = await interaction.fetchReply();
		((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
		const info = await transaction.fetch(`/interaction/${message.id}`);
		Object.assign(info, {
			id: message.id,
			type: "teamCreate",
			futureTeamId: interaction.id,
			futureTeamName: teamName,
			waiting: await (async () => {
				const waiting = [];
				for (const teamMate of teamMates) {
					waiting.push((await findUser(transaction, { discordUserId: teamMate.id }))!.id);
				}
				return waiting;
			})(),
			accepted: [],
			declined: [],
			caller: (await findUser(transaction, { discordUserId: caller.id }))!.id,
		});
		// complete command and commit transaction
		await transaction.commit();
		// create message that has buttons for confirming stuff
		await message.edit({
			content: `Awaiting confirmation from ${teamMates.map(teamMate => teamMate.toString()).join(", ")} to create new team called ${teamName}`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("accept")
						.setLabel("Accept")
						.setStyle("SUCCESS"),
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
	async join(interaction: CommandInteraction, metadata: any) {
		assert(interaction.guild);
		assert(interaction.channel);
		const teamName = interaction.options.getString("team-name", true);
		// log command and setup transaction
		console.log([ "team", "join", teamName, metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// fail if team with name doesnt exists
		const team = await findTeam(transaction, { name: teamName });
		if (team == null) {
			await interaction.editReply(`Team called ${teamName} doesn't exist`);
			return;
		}
		// create caller
		if (await findUser(transaction, { discordUserId: caller.id }) == null) {
			await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
		}
		// fail if caller is already in a team
		if ((await findUser(transaction, { discordUserId: caller.id }))!.teamId != null) {
			await interaction.editReply(`You are still in a team`);
			return;
		}
		const teamMates = [];
		for (const memberId of team.memberIds) {
			teamMates.push(await interaction.guild.members.fetch((await fetchUser(transaction, memberId)).discordUserId));
		};
		// confirm with caller
		await interaction.editReply({
			content: `Just to confirm, are you attempting to join team ${team.name} with members ${teamMates.map(member => member.user.username).join(", ")}?`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("yes")
						.setLabel("Confirm")
						.setStyle("SUCCESS"),
					new MessageButton()
						.setCustomId("no")
						.setLabel("Cancel")
						.setStyle("DANGER"),
				),
			],
		});
		// using awaitMessageComponent here because confirming stuff after more then 15 mins is sus
		let nextInteraction;
		try {
			nextInteraction = await (await interaction.channel.messages.fetch((await interaction.fetchReply()).id)).awaitMessageComponent({
				filter: (interaction: { user: { id: any; }; }) => interaction.user.id === caller.id,
				time: 10_000,
			});
		} catch (e) {
			nextInteraction = undefined;
		}
		if (nextInteraction == null) {
			await interaction.followUp({ content: `Confirmation timed out`, components: [] });
			return;
		}
		if (nextInteraction.customId === "no") {
			await interaction.followUp({ content: `Cancelled join request`, components: [] });
			return;
		}
		// fail if team is full
		if (team.memberIds.length >= 4) {
			await interaction.followUp(`Requested team is full`);
			return;
		}
		// create delayed interaction info
		const message = await (await interaction.channel.messages.fetch((await interaction.fetchReply()).id)).reply("...");
		// const message = await interaction.followUp({ content: ".", fetchReply: true });
		((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
		const info = await transaction.fetch(`/interaction/${message.id}`);
		Object.assign(info, {
			id: message.id,
			type: "teamJoin",
			teamId: team.id,
			waiting: [...team.memberIds],
			approved: [],
			rejected: [],
			caller: (await findUser(transaction, { discordUserId: caller.id }))!.id,
		});
		// complete command and commit transaction
		await transaction.commit();
		// create message that has buttons for confirming stuff
		await message.edit({
			content: `Awaiting approval from team ${teamName} with members ${teamMates.map(member => member.toString()).join(", ")} to approve ${caller} joining`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("approve")
						.setLabel("Approve")
						.setStyle("SUCCESS"),
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
	async rename(interaction: CommandInteraction, metadata: any) {
		assert(interaction.guild);
		assert(interaction.channel);
		const newTeamName = interaction.options.getString("new-team-name", true);
		// log command and setup transaction
		console.log([ "team", "rename", newTeamName, metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// create caller
		let callerUser = await findUser(transaction, { discordUserId: caller.id });
		if (callerUser == null) {
			callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
		}
		// fail if caller isn't in a team
		if (callerUser.teamId == null) {
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
		const team = await fetchTeam(transaction, callerUser.teamId);
		const teamMates = [];
		for (const memberId of team.memberIds) {
			teamMates.push(await interaction.guild.members.fetch((await fetchUser(transaction, memberId)).discordUserId));
		};
		// create delayed interaction info
		await interaction.editReply(".");
		const message = await interaction.channel.messages.fetch((await interaction.fetchReply()).id);
		// const message = await interaction.fetchReply();
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
		await message.edit({
			content: `Awaiting approval from team members ${teamMates.filter(member => member.id !== caller.id).map(member => member.toString()).join(", ")} to approve renaming team to ${newTeamName}`,
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId("approve")
						.setLabel("Approve")
						.setStyle("SUCCESS"),
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
	async leave(interaction: { user: any; guild: any; id: any; editReply: (arg0: string) => any; }, metadata: any) {
		// log command and setup transaction
		console.log([ "team", "leave", metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// create caller
		let callerUser = await findUser(transaction, { discordUserId: caller.id });
		if (callerUser == null) {
			callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
		}
		// fail if caller isn't in a team
		if (callerUser.teamId == null) {
			await interaction.editReply(`You are not in a team`);
			return;
		}
		// complete command and commit transaction
		await transaction.commit();
		// create message with further instructions for leaving a team
		await interaction.editReply([
			"Hello! It seems you want to leave your team. ",
			"There are many consequences with leaving a team, such as",
			"not being able to join back, no points being awarded to you after this month, and more.",
			"If you understand these consequences and still wish to continue,",
			"please DM a leader for further action. Thanks :D",
		].join(" "));
	},
	"join-random": async (interaction: CommandInteraction, metadata: any) => {
		assert(interaction.guild);
		assert(interaction.channel);
		// log command and setup transaction
		console.log([ "team", "join-random", metadata ]);
		const transaction = createTransaction(resources);
		const caller = interaction.user;
		// create caller
		let callerUser = await findUser(transaction, { discordUserId: caller.id });
		if (callerUser == null) {
			callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
		}
		// fail if caller is in a team
		if (callerUser.teamId != null) {
			await interaction.editReply(`You are already in a team`);
			return;
		}
		// get joinRandom info
		const joinRandomInfo = await transaction.fetch(`/joinRandom`);
		// if there's another person tryna join a team
		if ("start" in joinRandomInfo) {
			// fail if its the same dude lol
			if (joinRandomInfo.caller === callerUser.id) {
				await interaction.editReply(`You are already waiting to join a random team`);
				return;
			}
			// generate a random team name that doesn't exist
			const teamName = `${Math.floor(Math.random() * 2000)}`
			if (await findTeam(transaction, { name: teamName }) != null)
				throw Error("lol just try again pls: team name collided");
			const otherUser = await fetchUser(transaction, joinRandomInfo.caller);
			// fail if the other dude made a team already
			if (otherUser.teamId == null) {
				// make a team with them and have it be open to others
				const team = await createTeam(interaction.guild, transaction, { id: interaction.id, name: teamName, freeToJoin: true });
				await joinTeam(interaction.guild, transaction, team, otherUser);
				await joinTeam(interaction.guild, transaction, team, callerUser);
				// remove previous message and clear info
				(await (await interaction.guild.channels.fetch(joinRandomInfo.discordChannelId) as TextChannel).messages.fetch(joinRandomInfo.discordMessageId)).delete();
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
				clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
				clearObject(joinRandomInfo);
				// complete command
				await transaction.commit();
				await interaction.editReply(`Team ${team.name} with members ${await interaction.guild.members.fetch(callerUser.discordUserId)} and ${await interaction.guild.members.fetch(otherUser.discordUserId)} is created`);
				return;
			}
		}
		// create delayed interaction info
		const message = await interaction.channel.messages.fetch((await interaction.fetchReply()).id);
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
client.on("interactionCreate", async (interaction: Interaction) => {
	if (!interaction.isButton())
		return;
	await interaction.deferUpdate();
	console.log({
		timestamp: Date.now(),
		userDisplayName: `${interaction.user.username}#${interaction.user.discriminator}`,
		userId: interaction.user.id,
		messageId: interaction.message.id,
		customId: interaction.customId,
	});
	try {
		if (running) return;
		running = true;
		assert(interaction.guild);
		assert(interaction.channel);
		const message = await interaction.channel.messages.fetch((await interaction.fetchReply()).id);
		const caller = await interaction.guild.members.fetch(interaction.user.id);
		const transaction = createTransaction(resources);
		if (!((await transaction.fetch(`/interactions`)).interactionIds ?? []).includes(interaction.message.id)) {
			// await interaction.editReply(`Could not find interaction to continue`);
			console.log("unknown interaction");
			return;
		}
		const info = await transaction.fetch(`/interaction/${interaction.message.id}`);
		if (info.type === "teamCreate") {
			// ensure caller
			let callerUser = await findUser(transaction, { discordUserId: caller.id });
			if (callerUser == null) {
				callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
			}
			if (interaction.customId === "accept") {
				if (info.caller === callerUser.id) {
					await message.reply(`Caller cannot accept own invitation`);
					return;
				} else if (info.accepted.includes(callerUser.id)) {
					await message.reply(`Caller cannot accept invitation again`);
					return;
				} else if (info.declined.includes(callerUser.id)) {
					await message.reply(`Caller cannot accept invitation after declining`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await message.reply(`Caller wasn't invited`);
					return;
				}
				// fail if caller is already in a team
				if (callerUser.teamId != null) {
					await transaction.commit();
					await message.reply(`Caller is on a team`);
					return;
				}
				if (info.accepted.length === 1) {
					// fail if another team with same name exists
					if (await findTeam(transaction, { name: info.futureTeamName }) != null) {
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.reply(`Team called ${info.futureTeamName} now exists`);
						return;
					}
					removeFromArray(info.waiting, callerUser.id);
					info.accepted.push(callerUser.id);
					// create team
					const team = await createTeam(interaction.guild, transaction, {
						id: info.futureTeamId,
						name: info.futureTeamName,
					});
					for (const userId of [info.caller, ...info.accepted]) {
						await joinTeam(interaction.guild, transaction, team, await fetchUser(transaction, userId));
					}
					const teamMates = [];
					for (const memberId of team.memberIds) {
						teamMates.push(await interaction.guild.members.fetch((await fetchUser(transaction, memberId)).discordUserId));
					};
					if (info.waiting.length === 0) {
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
					}
					await transaction.commit();
					await message.reply(`Team ${team.name} with members ${teamMates.map(member => member.toString()).join(", ")} is created`);
					return;
				} else {
					// fail if team is full
					const team = await fetchTeam(transaction, info.futureTeamId)
					if (team.memberIds.length >= 4) {
						await transaction.commit();
						await message.reply(`Team ${info.futureTeamName} is now full`);
						return;
					}
					removeFromArray(info.waiting, callerUser.id);
					info.accepted.push(callerUser.id);
					await joinTeam(interaction.guild, transaction, team, callerUser);
					if (info.waiting.length === 0) {
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
					}
					await transaction.commit();
					await message.reply(`Accepted invitation to ${team.name}`);
					return;
				}
			}
			if (interaction.customId === "decline") {
				if (info.caller === callerUser.id) {
					await message.reply(`Caller cannot decline own invitation`);
					return;
				} else if (info.declined.includes(callerUser.id)) {
					await message.reply(`Caller cannot decline invitation again`);
					return;
				} else if (info.accepted.includes(callerUser.id)) {
					await message.reply(`Caller cannot decline invitation after accepting`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await message.reply(`Caller wasn't invited`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.declined.push(callerUser.id);
				if (info.waiting.length == 0) {
					const teamName = info.futureTeamName;
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.reply(`Team ${teamName} will not be created`);
					return;
				}
				await transaction.commit();
				await message.reply(`Declined invitation to ${info.futureTeamName}`);
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					await message.reply(`Caller isn't inviter`);
					return;
				}
				const teamName = info.futureTeamName;
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await message.reply(`Invitations to team ${teamName} cancelled`);
				return;
			}
		}
		if (info.type === "teamJoin") {
			const team = await fetchTeam(transaction, info.teamId);
			const numMembers = info.waiting.length + info.approved.length + info.declined.length;
			// ensure caller
			let callerUser = await findUser(transaction, { discordUserId: caller.id });
			if (callerUser == null) {
				callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
			}
			if (interaction.customId === "approve") {
				if (info.approved.includes(callerUser.id)) {
					await message.reply(`Caller cannot approve join request again`);
					return;
				} else if (info.rejected.includes(callerUser.id)) {
					await message.reply(`Caller cannot approve join request after rejecting`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await message.reply(`Caller not in team`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.approved.push(callerUser.id);
				const callerDiscordUser = await interaction.guild.members.fetch((await fetchUser(transaction, info.caller)).discordUserId);
				if (info.approved.length > numMembers / 2) {
					// fail if team is full
					if (team.memberIds.length >= 4) {
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.reply(`${callerDiscordUser}'s requested team is now full`);
						return;
					}
					// fail if caller is already in a team
					if (callerUser.teamId != null) {
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.reply(`${callerDiscordUser} now has a team`);
						return;
					}
					await joinTeam(interaction.guild, transaction, team, callerUser);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.reply(`${callerDiscordUser} joined team ${team.name}`);
					return;
				}
				await transaction.commit();
				await message.reply(`Approved request from ${callerDiscordUser.user.username} to ${team.name}`);
				return;
			}
			if (interaction.customId === "reject") {
				if (info.rejected.includes(callerUser.id)) {
					await message.reply(`Caller cannot reject join request again`);
					return;
				} else if (info.approved.includes(callerUser.id)) {
					await message.reply(`Caller cannot reject join request after approving`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await message.reply(`Caller not in team`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.rejected.push(callerUser.id);
				const callerDiscordUser = await interaction.guild.members.fetch((await fetchUser(transaction, info.caller)).discordUserId);
				if (info.rejected.length >= numMembers / 2) {
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.reply(`Rejected ${callerDiscordUser}'s request to join team ${team.name}`);
					return;
				}
				await transaction.commit();
				await message.reply(`Rejected request from ${callerDiscordUser.user.username} to ${team.name}`);
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					await message.reply(`Caller isn't join requester`);
					return;
				}
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await message.reply(`Request to join ${team.name} was cancelled`);
				return;
			}
		}
		if (info.type === "teamRename") {
			const team = await fetchTeam(transaction, info.teamId);
			const numMembers = info.waiting.length + info.approved.length + info.rejected.length;
			// ensure caller
			let callerUser = await findUser(transaction, { discordUserId: caller.id });
			if (callerUser == null) {
				callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
			}
			if (interaction.customId === "approve") {
				if (info.caller === callerUser.id) {
					await message.reply(`Caller cannot approve own rename request`);
					return;
				} else if (info.approved.includes(callerUser.id)) {
					await message.reply(`Caller cannot approve rename request again`);
					return;
				} else if (info.rejected.includes(callerUser.id)) {
					await message.reply(`Caller cannot approve rename request after rejecting`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await message.reply(`Caller not in team`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.approved.push(callerUser.id);
				if (info.approved.length > numMembers / 2) {
					const oldTeamName = team.name;
					// fail if another team with same name exists
					if (await findTeam(transaction, { name: info.newTeamName }) != null) {
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.reply(`Team called ${info.newTeamName} now exists`);
						return;
					}
					await renameTeam(interaction.guild, transaction, team, info.newTeamName);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.reply(`Renamed team ${oldTeamName} to ${team.name}`);
					return;
				}
				await transaction.commit();
				await message.reply(`Approved rename request from ${team.name} to ${info.newTeamName}`);
				return;
			}
			if (interaction.customId === "reject") {
				if (info.caller === callerUser.id) {
					await message.reply(`Caller cannot reject own rename request`);
					return;
				} else if (info.rejected.includes(callerUser.id)) {
					await message.reply(`Caller cannot reject rename request again`);
					return;
				} else if (info.approved.includes(callerUser.id)) {
					await message.reply(`Caller cannot reject rename request after approving`);
					return;
				} else if (!info.waiting.includes(callerUser.id)) {
					await message.reply(`Caller not in team`);
					return;
				}
				removeFromArray(info.waiting, callerUser.id);
				info.rejected.push(callerUser.id);
				if (info.rejected.length >= numMembers / 2) {
					const teamName = info.newTeamName;
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.reply(`Request to rename team ${team.name} to ${teamName} is rejected`);
					return;
				}
				await transaction.commit();
				await message.reply(`Rejected rename request from ${team.name} to ${info.newTeamName}`);
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					await message.reply(`Caller isn't rename requester`);
					return;
				}
				const teamName = info.newTeamName;
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await message.reply(`Request to rename team ${team.name} to ${teamName} is cancelled`);
				return;
			}
		}
		if (info.type === "teamJoinRandom") {
			// ensure caller
			let callerUser = await findUser(transaction, { discordUserId: caller.id });
			if (callerUser == null) {
				callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${caller.id}`, discordUserId: caller.id });
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					await message.reply(`Caller isn't join random requester`);
					return;
				}
				// remove interaction info and joinRandom info
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				const joinRandomInfo = await transaction.fetch(`/joinRandom`);
				(await (await interaction.guild.channels.fetch(joinRandomInfo.discordChannelId) as TextChannel).messages.fetch(joinRandomInfo.discordMessageId)).delete();
				clearObject(joinRandomInfo);
				// complete command
				await transaction.commit();
				await message.channel.send(`Cancelled join random request`);
				return;
			}
		}
		if (info.type === "workshopRole") {
			const workshop = await transaction.fetch(`/workshop/${info.workshopId}`);
			if (interaction.customId === "add") {
				await caller.roles.add(workshop.discordRoleId);
				// complete command
				await transaction.commit();
				return;
			}
			if (interaction.customId === "remove") {
				await caller.roles.remove(workshop.discordRoleId);
				// complete command
				await transaction.commit();
				return;
			}
		}
	} catch (e) {
		console.error(e);
		try {
			await interaction.followUp(`Oops, an internal error occurred: ${e}`);
		} catch (e) {}
	} finally {
		running = false;
	}
});

// Process slash commands
client.on("interactionCreate", async (interaction: Interaction) => {
	if (!interaction.isCommand())
		return;

	// defer reply cuz it might take a while maybe
	await interaction.deferReply();

	try {
		if (running) {
			await interaction.editReply("please try again later");
			return;
		}
		running = true;

		const metadata = {
			timestamp: Date.now(),
			userDisplayName: `${interaction.user.username}#${interaction.user.discriminator}`,
			userId: interaction.user.id,
		};
		assert(interaction.guild);
		assert(interaction.channel);

		if (interaction.commandName === "ping") {
			await interaction.editReply("pong");
			return;
		}

		if (interaction.commandName === "admin") {
			const caller = await interaction.guild.members.fetch(interaction.user.id);
			if (!caller.roles.cache.find((role: Role) => ["supervisor", "leader"].includes(role.name.toLowerCase()))) {
				await interaction.editReply(`You are not an admin`);
				return;
			}
			const subcommandName = interaction.options.getSubcommand(true);
			if (subcommandName === "get") {
				if (!caller.roles.cache.find((role: Role) => ["bot maintainer"].includes(role.name.toLowerCase()))) {
					await interaction.editReply(`You are not a bot maintainer`);
					return;
				}
				const key = interaction.options.getString("key", true);
				console.log([ "admin", "get", key, metadata ]);
				const [resource, ...properties] = key.split(".");
				let result = await resources.fetch(resource.trim());
				for (const property of properties)
					result = result?.[property.trim()];
				let out: string;
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
				if (!caller.roles.cache.find((role: Role) => ["bot maintainer"].includes(role.name.toLowerCase()))) {
					await interaction.editReply(`You are not a bot maintainer`);
					return;
				}
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
				const member = await interaction.guild.members.fetch(interaction.options.getUser("member", true).id);
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
				// fail if team name isn't easy
				const team = await fetchTeam(transaction, user.teamId);
				if (team.name !== teamName) {
					await interaction.editReply(`User is in team called ${team.name}, not ${teamName}`);
					return;
				}
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
				if (team == null) {
					await interaction.editReply(`Team does not exist`);
					return;
				}
				const teamMates = [];
				for (const memberId of team.memberIds) {
					teamMates.push(await interaction.guild.members.fetch((await fetchUser(transaction, memberId)).discordUserId));
				};
				// confirmation with a list of ppl in the team
				await interaction.editReply({
					content: `Just to confirm, are you attempting to destroy team ${team.name} with members ${teamMates.map(teamMate => teamMate.user.username).join(", ")}?`,
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId("yes")
								.setLabel("Confirm")
								.setStyle("SUCCESS"),
							new MessageButton()
								.setCustomId("no")
								.setLabel("Cancel")
								.setStyle("DANGER"),
						),
					],
				});
				// using awaitMessageComponent here because confirming stuff after more then 15 mins is sus
				let nextInteraction;
				try {
					nextInteraction = await (await interaction.channel.messages.fetch((await interaction.fetchReply()).id)).awaitMessageComponent({
						filter: (interaction: { user: { id: any; }; }) => interaction.user.id === caller.id,
						time: 10_000,
					});
				} catch (e) {
					nextInteraction = undefined;
				}
				if (nextInteraction == null) {
					await interaction.followUp({ content: `Confirmation timed out`, components: [] });
					return;
				}
				if (nextInteraction.customId === "no") {
					await interaction.followUp(`Cancelled team destruction`);
					return;
				}
				// destroy team
				for (const memberId of [...team.memberIds]) {
					await leaveTeam(interaction.guild, transaction, await fetchUser(transaction, memberId));
				}
				await destroyTeam(interaction.guild, transaction, team);
				// reply to interaction
				await transaction.commit();
				await interaction.followUp(`Destroyed team ${teamName}`);
				return;
			}
			if (subcommandName === "rename-team") {
				const teamName = interaction.options.getString("team-name", true);
				const newTeamName = interaction.options.getString("new-team-name", true);
				console.log([ "admin", "rename-team", teamName, newTeamName, metadata ]);
				const transaction = createTransaction(resources);
				// fail if team doesnt exist
				const team = await findTeam(transaction, { name: teamName });
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
			if (subcommandName === "move-to-breakout-rooms") {
				const workshopCode = interaction.options.getString("workshop-code", true);
				console.log([ "admin", "move-to-breakout-rooms", workshopCode, metadata ]);
				const transaction = createTransaction(resources);
				// fail if workshop doesn't exist
				const workshop = await transaction.fetch(`/workshop/${workshopCode}`);
				if (workshop.id == null) {
					await interaction.editReply(`Workshop does not exist`);
					return;
				}
				// move everyone in a workshop to their respective teams if they have one
				const channel = await interaction.guild.channels.fetch(workshop.discordVoiceChannelId);
				assert(channel);
				for (const [memberId, member] of channel.members.entries()) {
					let user = await findUser(transaction, { discordUserId: memberId });
					if (user == null) continue;
					if (user.teamId == null) continue;
					const team = await fetchTeam(transaction, user.teamId);
					const teamVoiceChannel = await interaction.guild.channels.fetch(team.discordVoiceChannelId) as VoiceChannel;
					await member.edit({ channel: teamVoiceChannel });
					await sleep(250);  // hopefully this is enough lol
				}
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Moved people who have a team into their voice channel`);
				return;
			}
			if (subcommandName === "register-workshop") {
				const workshopCode = interaction.options.getString("workshop-code", true);
				const workshopName = interaction.options.getString("workshop-name", true);
				console.log([ "admin", "register-workshop", workshopCode, workshopName, metadata ]);
				const transaction = createTransaction(resources);
				// fail if workshop code has caps or spaces
				if (!/^[-a-z0-9]+$/g.test(workshopCode)) {
					await interaction.editReply(`Workshop code can only have lowercase letters and dashes`);
					return;
				}
				// fail if workshop with code exists
				const workshop = await transaction.fetch(`/workshop/${workshopCode}`);
				if (workshop.id != null) {
					await interaction.editReply(`Workshop with same code exists`);
					return;
				}
				// fail if no workshops category exists
				const workshopsCategory = (await interaction.guild.channels.fetch()).find((channel: { name: string; }) => (
					channel instanceof CategoryChannel
					&& channel.name.toLowerCase() === "workshops"
				)) as CategoryChannel | undefined;
				if (workshopsCategory == null) {
					await interaction.editReply(`No workshops category exists`);
					return;
				}
				// fail if no workshops channel exists
				const workshopsChannel = (await interaction.guild.channels.fetch()).find((channel: { name: string; }) => (
					channel instanceof TextChannel
					&& channel.name.toLowerCase() === "workshops"
				)) as TextChannel | undefined;
				if (workshopsChannel == null) {
					await interaction.editReply(`No workshops channel exists`);
					return;
				}
				// create workshop
				((await transaction.fetch(`/workshops`)).ids ??= []).push(workshopCode);
				workshop.id = workshopCode;
				workshop.name = workshopName;
				workshop.hostDiscordUserId = interaction.user.id;
				// create delayed interaction info
				const message = await workshopsChannel.send(".");
				((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
				const info = await transaction.fetch(`/interaction/${message.id}`);
				Object.assign(info, {
					id: message.id,
					type: "workshopRole",
					workshopId: workshop.id,
				});
				workshop.interactionId = message.id;
				// create workshop role
				const role = await interaction.guild.roles.create({ name: `${workshopName}` });
				workshop.discordRoleId = role.id;
				// create workshop channels
				const channelOptions = { parent: workshopsCategory };
				const textChannel = await interaction.guild.channels.create(`${workshopName}`, { ...channelOptions });
				const voiceChannel = await interaction.guild.channels.create(`${workshopName}`, { type: "GUILD_VOICE", ...channelOptions });
				workshop.discordTextChannelId = textChannel.id;
				workshop.discordVoiceChannelId = voiceChannel.id;
				// reply to interaction
				await transaction.commit();
				await interaction.editReply(`Created workshop`);
				await message.edit({
					content: `Workshop: ${workshopName} by ${interaction.user} (code: ${workshopCode}). Press the button before to get the workshop role. (The host will ping this role for workshop specific announcements.)`,
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId("add")
								.setLabel(`Add ${workshopCode} role`)
								.setStyle("SUCCESS"),
							new MessageButton()
								.setCustomId("remove")
								.setLabel(`Remove ${workshopCode} role`)
								.setStyle("DANGER"),
						),
					]
				});
				return;
			}
			if (subcommandName === "list-all-teams") {
				console.log([ "admin", "list-all-teams", metadata ]);
				const result = [];
				let first = true;
				for (const teamId of (await fetchTeams(resources)).teamIds) {
					const team = await fetchTeam(resources, teamId);
					const teamMates = [];
					for (const memberId of team.memberIds) {
						teamMates.push(await interaction.guild.members.fetch((await fetchUser(resources, memberId)).discordUserId));
					};
					result.push(`Team ${team.name} with ID ${team.id} and members ${teamMates.map(member => member.user.username).join(", ")}`);
					if (result.length >= 8) {
						if (first) {
							await interaction.editReply(result.join("\n"));
							first = false;
						} else {
							await interaction.followUp(result.join("\n"));
						}
						result.splice(0, result.length);
					}
				}
				if (result.length > 0) {
					if (first) {
						await interaction.editReply(result.join("\n"));
					} else {
						await interaction.followUp(result.join("\n"));
					}
				} else if (first) {
					await interaction.editReply("no teams :/");
				}
				return;
			}
			if (subcommandName === "list-all-workshops") {
				console.log([ "admin", "list-all-workshops", metadata ]);
				const result = [];
				let first = true;
				for (const workshopId of (await resources.fetch(`/workshops`)).ids ??= []) {
					const workshop = await resources.fetch(`/workshop/${workshopId}`);
					result.push(`${workshop.name} with code ${workshop.id} hosted by ${(await interaction.guild.members.fetch(workshop.hostDiscordUserId)).user.username}`);
					if (result.length >= 8) {
						if (first) {
							await interaction.editReply(result.join("\n"));
							first = false;
						} else {
							await interaction.followUp(result.join("\n"));
						}
						result.splice(0, result.length);
					}
				}
				if (result.length > 0) {
					if (first) {
						await interaction.editReply(result.join("\n"));
					} else {
						await interaction.followUp(result.join("\n"));
					}
				} else if (first) {
					await interaction.editReply("no workshops :/");
				}
				return;
			}
			if (subcommandName === "delete-workshop") {
				const workshopCode = interaction.options.getString("workshop-code", true);
				const removeFromDatastore = interaction.options.getBoolean("remove-from-datastore", false) ?? false;
				console.log([ "admin", "delete-workshop", workshopCode, metadata ]);
				const transaction = createTransaction(resources);
				// fail if workshop doesnt exist
				const workshop = await transaction.fetch(`/workshop/${workshopCode}`);
				if (workshop.id == null) {
					await interaction.editReply(`Workshop does not exist`);
					return;
				}
				// confirmation
				await interaction.editReply({
					content: `Just to confirm, are you attempting to destroy ${workshop.name} with code ${workshop.id}`,
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId("yes")
								.setLabel("Confirm")
								.setStyle("SUCCESS"),
							new MessageButton()
								.setCustomId("no")
								.setLabel("Cancel")
								.setStyle("DANGER"),
						),
					],
				});
				// using awaitMessageComponent here because confirming stuff after more then 15 mins is sus
				let nextInteraction;
				try {
					nextInteraction = await (await interaction.channel.messages.fetch((await interaction.fetchReply()).id)).awaitMessageComponent({
						filter: (interaction: { user: { id: any; }; }) => interaction.user.id === caller.id,
						time: 10_000,
					});
				} catch (e) {
					nextInteraction = undefined;
				}
				if (nextInteraction == null) {
					await interaction.editReply({ content: `Confirmation timed out`, components: [] });
					return;
				}
				if (nextInteraction.customId === "no") {
					await interaction.followUp(`Cancelled workshop destruction`);
					return;
				}
				// destroy workshop interaction
				if (workshop.interactionId) {
					removeFromArray((await transaction.fetch(`/interactions`)).ids ??= [], workshop.interactionId);
					clearObject(await transaction.fetch(`/interaction/${workshop.interactionId}`));
				}
				// destroy workshop role
				if (workshop.discordRoleId) {
					const role = await interaction.guild.roles.fetch(workshop.discordRoleId);
					assert(role);
					await role.delete();
				}
				// destroy workshop channels
				if (workshop.discordTextChannelId) {
					const textChannel = await interaction.guild.channels.fetch(workshop.discordTextChannelId);
					assert(textChannel);
					await textChannel.delete();
				}
				if (workshop.discordVoiceChannelId) {
					const voiceChannel = await interaction.guild.channels.fetch(workshop.discordVoiceChannelId);
					assert(voiceChannel);
					await voiceChannel.delete();
				}
				// destroy team if required
				if (removeFromDatastore) {
					removeFromArray((await transaction.fetch(`/workshops`)).ids ??= [], workshop.id);
					clearObject(workshop);
					// reply to interaction
					await transaction.commit();
					await interaction.followUp(`Destroyed workshop ${workshopCode} and removed it from the datastore`);
					return;
				}
				// reply to interaction
				await transaction.commit();
				await interaction.followUp(`Destroyed workshop ${workshopCode}`);
				return;
			}
		}

		if (interaction.commandName === "profile") {
			console.log([ "profile", metadata ]);
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
			/*
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
			*/
			const pointsThisMonth = 0; const numMedals = 0;
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

		if (interaction.commandName === "team") {
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
	} finally {
		running = false;
	}
});

client.login(process.env.BOT_TOKEN);
